import type {
  Crossing,
  EdgeId,
  Exit,
  NodeId,
  Platform,
  Point,
  Signal,
  StationLayout,
  Switch,
  SwitchId,
  SwitchState,
  ThroughTrack,
  TrackEdge,
  TrackId,
  TrackNode,
} from './types';

export interface EdgeGeometry extends TrackEdge {
  a: Point;
  b: Point;
  length: number;
}

export type SwitchStates = Readonly<Record<SwitchId, SwitchState>>;

export type NextEdgeResult =
  | { kind: 'edge'; edge: EdgeGeometry }
  | { kind: 'exit' }
  | { kind: 'blocked'; reason: 'switch-not-set' | 'dead-end' };

/** Indexed, geometry-enriched view of a layout. Immutable after construction. */
export class TrackGraph {
  readonly layout: StationLayout;
  readonly nodes: ReadonlyMap<NodeId, TrackNode>;
  readonly edges: ReadonlyMap<EdgeId, EdgeGeometry>;
  readonly switches: ReadonlyMap<SwitchId, Switch>;
  readonly switchByNode: ReadonlyMap<NodeId, Switch>;
  readonly signalByFromEdge: ReadonlyMap<EdgeId, Signal>;
  readonly platformByEdge: ReadonlyMap<EdgeId, Platform>;
  readonly platformById: ReadonlyMap<TrackId, Platform>;
  readonly throughByEdge: ReadonlyMap<EdgeId, ThroughTrack>;
  readonly throughById: ReadonlyMap<TrackId, ThroughTrack>;
  readonly crossingByNode: ReadonlyMap<NodeId, Crossing>;
  /** Crossings touched by each of their four edges. */
  readonly crossingByEdge: ReadonlyMap<EdgeId, Crossing>;
  readonly exitByEdge: ReadonlyMap<EdgeId, Exit>;
  readonly exitById: ReadonlyMap<string, Exit>;
  private readonly outEdges: ReadonlyMap<NodeId, EdgeGeometry[]>;

  constructor(layout: StationLayout) {
    this.layout = layout;
    const nodes = new Map(layout.nodes.map((n) => [n.id, n]));
    const edges = new Map<EdgeId, EdgeGeometry>();
    const outEdges = new Map<NodeId, EdgeGeometry[]>();
    for (const e of layout.edges) {
      const from = nodes.get(e.from);
      const to = nodes.get(e.to);
      if (!from || !to) throw new Error(`Edge ${e.id} references unknown node`);
      const geo: EdgeGeometry = {
        ...e,
        a: from.pos,
        b: to.pos,
        length: Math.hypot(to.pos.x - from.pos.x, to.pos.y - from.pos.y),
      };
      edges.set(e.id, geo);
      const list = outEdges.get(e.from) ?? [];
      list.push(geo);
      outEdges.set(e.from, list);
    }
    for (const sw of layout.switches) {
      for (const id of [sw.toe, sw.normal, sw.reverse]) {
        if (!edges.has(id)) throw new Error(`Switch ${sw.id} references unknown edge ${id}`);
      }
    }
    this.nodes = nodes;
    this.edges = edges;
    this.outEdges = outEdges;
    this.switches = new Map(layout.switches.map((s) => [s.id, s]));
    this.switchByNode = new Map(layout.switches.map((s) => [s.node, s]));
    this.signalByFromEdge = new Map(layout.signals.map((s) => [s.fromEdge, s]));
    this.platformByEdge = new Map(layout.platforms.map((p) => [p.edge, p]));
    this.platformById = new Map(layout.platforms.map((p) => [p.id, p]));
    this.throughByEdge = new Map(layout.throughTracks.map((t) => [t.edge, t]));
    this.throughById = new Map(layout.throughTracks.map((t) => [t.id, t]));
    this.crossingByNode = new Map(layout.crossings.map((c) => [c.node, c]));
    const crossingByEdge = new Map<EdgeId, Crossing>();
    for (const c of layout.crossings) {
      for (const pair of c.pairs) {
        for (const id of [pair.from, pair.to]) {
          if (!edges.has(id)) throw new Error(`Crossing ${c.id} references unknown edge ${id}`);
          crossingByEdge.set(id, c);
        }
      }
    }
    this.crossingByEdge = crossingByEdge;
    this.exitByEdge = new Map(layout.exits.map((x) => [x.edge, x]));
    this.exitById = new Map(layout.exits.map((x) => [x.id, x]));
  }

  /** True when a destination is a platform (the train stops), false for a through track. */
  isStoppingDestination(destination: TrackId): boolean {
    if (this.platformById.has(destination)) return true;
    if (this.throughById.has(destination)) return false;
    throw new Error(`Unknown destination ${destination}`);
  }

  edge(id: EdgeId): EdgeGeometry {
    const e = this.edges.get(id);
    if (!e) throw new Error(`Unknown edge ${id}`);
    return e;
  }

  node(id: NodeId): TrackNode {
    const n = this.nodes.get(id);
    if (!n) throw new Error(`Unknown node ${id}`);
    return n;
  }

  pointAlong(edge: EdgeGeometry, offset: number): Point {
    const t = edge.length === 0 ? 0 : Math.min(1, Math.max(0, offset / edge.length));
    return { x: edge.a.x + (edge.b.x - edge.a.x) * t, y: edge.a.y + (edge.b.y - edge.a.y) * t };
  }

  /** Default state for every switch: `normal`. */
  defaultSwitchStates(): Record<SwitchId, SwitchState> {
    const states: Record<SwitchId, SwitchState> = {};
    for (const sw of this.layout.switches) states[sw.id] = 'normal';
    return states;
  }

  /** All four edges of a crossing. */
  crossingEdges(crossing: Crossing): EdgeId[] {
    return crossing.pairs.flatMap((pair) => [pair.from, pair.to]);
  }

  /** Edges attached to a switch node (toe + both legs). */
  switchEdges(sw: Switch): EdgeId[] {
    return [sw.toe, sw.normal, sw.reverse];
  }

  /**
   * Resolve where a train travelling along `fromEdge` goes after reaching its `to` node,
   * given the current switch states.
   */
  nextEdge(fromEdge: EdgeId, states: SwitchStates): NextEdgeResult {
    const edge = this.edge(fromEdge);
    const node = edge.to;
    const sw = this.switchByNode.get(node);
    if (sw) {
      const state = states[sw.id] ?? 'normal';
      const selectedLeg = state === 'normal' ? sw.normal : sw.reverse;
      if (fromEdge === sw.toe) {
        return { kind: 'edge', edge: this.edge(selectedLeg) };
      }
      if (fromEdge === sw.normal || fromEdge === sw.reverse) {
        if (selectedLeg !== fromEdge) return { kind: 'blocked', reason: 'switch-not-set' };
        return { kind: 'edge', edge: this.edge(sw.toe) };
      }
      throw new Error(`Edge ${fromEdge} ends at switch ${sw.id} but is not attached to it`);
    }
    const crossing = this.crossingByNode.get(node);
    if (crossing) {
      const pair = crossing.pairs.find((pr) => pr.from === fromEdge);
      if (!pair)
        throw new Error(`Edge ${fromEdge} ends at crossing ${crossing.id} but is not paired`);
      return { kind: 'edge', edge: this.edge(pair.to) };
    }
    const out = this.outEdges.get(node) ?? [];
    if (out.length === 0) return { kind: 'exit' };
    const [only] = out;
    if (out.length > 1 || !only) return { kind: 'blocked', reason: 'dead-end' };
    return { kind: 'edge', edge: only };
  }
}
