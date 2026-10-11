import { gsap } from 'gsap';
import { Circle, Container, Graphics, Text } from 'pixi.js';

import type { EdgeGeometry, TrackGraph } from '../core/graph';
import { DEFAULT_PLATFORM_MARGIN } from '../core/types';
import type { Simulation } from '../core/simulation';
import type { Train } from '../core/train';
import type {
  Aspect,
  Point,
  ScheduledTrain,
  Signal,
  SignalId,
  Switch,
  SwitchId,
  TrackId,
} from '../core/types';

export interface RendererHandlers {
  onSwitchTap: (id: SwitchId) => void;
  onSignalTap: (id: SignalId) => void;
}

export const STAGE_WIDTH = 1200;
export const STAGE_HEIGHT = 500;

export const COLORS = {
  background: 0x0b1220,
  trackIdle: 0x3b4654,
  trackRoute: 0xcbd5e1,
  trackOccupied: 0xef4444,
  switchBlade: 0xfacc15,
  switchLocked: 0xf97316,
  signalRed: 0xef4444,
  signalYellow: 0xfacc15,
  signalGreen: 0x22c55e,
  signalOff: 0x1f2937,
  signalHead: 0x111827,
  platform: 0x1e293b,
  platformEdge: 0x475569,
  text: 0x94a3b8,
  textBright: 0xe2e8f0,
  trainHead: 0xf8fafc,
  moneyUp: 0x4ade80,
  moneyDown: 0xf87171,
} as const;

const DESTINATION_COLORS: Record<TrackId, number> = {
  P1: 0x60a5fa,
  P2: 0xf472b6,
  P3: 0xfbbf24,
  T: 0xc084fc,
};

export function platformColor(id: TrackId): number {
  return DESTINATION_COLORS[id] ?? 0x34d399;
}

/** Express trains stand out from ordinary through trains. */
const EXPRESS_COLOR = 0x22d3ee;

/** Colour of a train, its label and its queue pill. */
export function trainColor(plan: ScheduledTrain): number {
  return plan.express ? EXPRESS_COLOR : platformColor(plan.destination);
}

const TRACK_WIDTH = 6;
const TRAIN_WIDTH = 12;
const DWELL_BAR_OFFSET = 13;
const DWELL_BAR_HEIGHT = 4;
const BLADE_LENGTH = 22;
const SWITCH_HIT_RADIUS = 16;
const SIGNAL_HIT_RADIUS = 13;
/** Pending trains shown above the approach sections. */
const QUEUE_MAX_PENDING = 4;
const QUEUE_ROW = 20;
const QUEUE_HEIGHT = 14;
const QUEUE_WIDTH = 118;
/** Height of the band where pending trains slide down before reaching the approach. */
const QUEUE_ETA_HEIGHT = 70;
/** A pending pill starts sliding down this many seconds before its train is due. */
const QUEUE_HORIZON_SECONDS = 90;
const QUEUE_LEFT_INSET = 24;
/** Money popups never start closer than this to the stage edge. */
const MONEY_EDGE_INSET = 14;

const aspectColor = (aspect: Aspect | undefined): number => {
  switch (aspect) {
    case 'red':
      return COLORS.signalRed;
    case 'yellow':
      return COLORS.signalYellow;
    case 'green':
      return COLORS.signalGreen;
    default:
      return COLORS.signalOff;
  }
};

const unit = (a: Point, b: Point): Point => {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
};

/**
 * Draws the schematic station: platforms, tracks, switches, signals and trains.
 * It never mutates the simulation; switch clicks are reported through `onSwitchTap`.
 */
export class StationRenderer {
  readonly root = new Container();

  private readonly graph: TrackGraph;
  private readonly staticLayer = new Graphics();
  private readonly trackLayer = new Graphics();
  private readonly switchLayer = new Graphics();
  private readonly signalLayer = new Graphics();
  private readonly trainLayer = new Graphics();
  private readonly labelLayer = new Container();
  private readonly hitLayer = new Container();
  private readonly trainLabels = new Map<string, Text>();
  private readonly queueLayer = new Graphics();
  private readonly queueLabels: Text[] = [];
  private readonly moneyLayer = new Container();
  /** Index of the first simulation event not yet turned into a money popup. */
  private eventCursor = 0;

  constructor(graph: TrackGraph, handlers: RendererHandlers) {
    this.graph = graph;
    this.root.addChild(
      this.staticLayer,
      this.trackLayer,
      this.switchLayer,
      this.signalLayer,
      this.trainLayer,
      this.queueLayer,
      this.labelLayer,
      this.moneyLayer,
      this.hitLayer,
    );
    this.drawStatic();
    this.createSwitchHitAreas(handlers.onSwitchTap);
    this.createSignalHitAreas(handlers.onSignalTap);
  }

  /** Redraw everything that depends on simulation state. */
  update(sim: Simulation): void {
    this.drawTracks(sim);
    this.drawSwitches(sim);
    this.drawSignals(sim);
    this.drawTrains(sim);
    this.drawUpcoming(sim);
    this.spawnMoneyPopups(sim);
  }

  /** Forget cached per-train display objects (call when a new simulation starts). */
  reset(): void {
    for (const label of this.trainLabels.values()) label.destroy();
    this.trainLabels.clear();
    for (const label of this.queueLabels) label.visible = false;
    this.eventCursor = 0;
    for (const popup of [...this.moneyLayer.children]) {
      gsap.killTweensOf(popup);
      gsap.killTweensOf(popup.scale);
      popup.destroy();
    }
  }

  // ---------------------------------------------------------------------------------------

  private drawStatic(): void {
    const g = this.staticLayer;
    const { layout } = this.graph;

    for (const platform of layout.platforms) {
      const edge = this.graph.edge(platform.edge);
      const margin = platform.margin ?? DEFAULT_PLATFORM_MARGIN;
      const x0 = Math.min(edge.a.x, edge.b.x) + margin;
      const x1 = Math.max(edge.a.x, edge.b.x) - margin;
      const y = edge.a.y - 34;
      g.roundRect(x0, y, x1 - x0, 20, 4)
        .fill(COLORS.platform)
        .stroke({
          width: 1,
          color: COLORS.platformEdge,
        });
      const label = new Text({
        text: platform.name.toUpperCase(),
        style: {
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: 12,
          fontWeight: 'bold',
          fill: platformColor(platform.id),
        },
      });
      label.anchor.set(0.5);
      label.position.set((x0 + x1) / 2, y + 10);
      this.labelLayer.addChild(label);
    }

    for (const through of layout.throughTracks) {
      const edge = this.graph.edge(through.edge);
      const x0 = Math.min(edge.a.x, edge.b.x) + DEFAULT_PLATFORM_MARGIN;
      const x1 = Math.max(edge.a.x, edge.b.x) - DEFAULT_PLATFORM_MARGIN;
      const y = edge.a.y - 22;
      this.addLabel(
        `${through.name.toUpperCase()} · NO STOP ▶▶`,
        (x0 + x1) / 2,
        y,
        0.5,
        platformColor(through.id),
      );
    }

    for (const exit of layout.exits) {
      const edge = this.graph.edge(exit.edge);
      this.addLabel(
        `${exit.id} ▶  ${exit.name.toUpperCase()}`,
        edge.b.x,
        edge.b.y - 16,
        1,
        COLORS.textBright,
      );
    }
  }

  private addLabel(text: string, x: number, y: number, anchorX: number, fill: number): void {
    const label = new Text({
      text,
      style: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, fill },
    });
    label.anchor.set(anchorX, 0.5);
    label.position.set(x, y);
    this.labelLayer.addChild(label);
  }

  private createSwitchHitAreas(onSwitchTap: (id: SwitchId) => void): void {
    for (const sw of this.graph.layout.switches) {
      const node = this.graph.node(sw.node);
      const hit = new Graphics();
      hit.circle(node.pos.x, node.pos.y, SWITCH_HIT_RADIUS).fill({ color: 0xffffff, alpha: 0.001 });
      hit.hitArea = new Circle(node.pos.x, node.pos.y, SWITCH_HIT_RADIUS);
      hit.eventMode = 'static';
      hit.cursor = 'pointer';
      hit.on('pointertap', () => onSwitchTap(sw.id));
      this.hitLayer.addChild(hit);
    }
  }

  /** Centre of a signal's head on screen. */
  private signalHeadCentre(signal: Signal): Point {
    const node = this.graph.node(signal.node).pos;
    const s = signal.side === 'below' ? 1 : -1;
    return { x: node.x, y: s < 0 ? node.y - 29 : node.y + 29 };
  }

  private createSignalHitAreas(onSignalTap: (id: SignalId) => void): void {
    for (const signal of this.graph.layout.signals) {
      const centre = this.signalHeadCentre(signal);
      if (centre.x < 0 || centre.x > STAGE_WIDTH) continue;
      const hit = new Graphics();
      hit.circle(centre.x, centre.y, SIGNAL_HIT_RADIUS).fill({ color: 0xffffff, alpha: 0.001 });
      hit.hitArea = new Circle(centre.x, centre.y, SIGNAL_HIT_RADIUS);
      hit.eventMode = 'static';
      hit.cursor = 'pointer';
      hit.on('pointertap', () => onSignalTap(signal.id));
      this.hitLayer.addChild(hit);
    }
  }

  private strokeEdge(g: Graphics, edge: EdgeGeometry, color: number, width: number): void {
    g.moveTo(edge.a.x, edge.a.y)
      .lineTo(edge.b.x, edge.b.y)
      .stroke({ width, color, cap: 'round', join: 'round' });
  }

  private drawTracks(sim: Simulation): void {
    const g = this.trackLayer;
    g.clear();
    for (const edge of this.graph.edges.values()) {
      const color = sim.occupied.has(edge.id)
        ? COLORS.trackOccupied
        : sim.locked.has(edge.id)
          ? COLORS.trackRoute
          : COLORS.trackIdle;
      this.strokeEdge(g, edge, color, TRACK_WIDTH);
    }
  }

  private legDirection(sw: Switch, legId: string): Point {
    const node = this.graph.node(sw.node).pos;
    const leg = this.graph.edge(legId);
    const far = leg.from === sw.node ? leg.b : leg.a;
    return unit(node, far);
  }

  private drawSwitches(sim: Simulation): void {
    const g = this.switchLayer;
    g.clear();
    for (const sw of this.graph.layout.switches) {
      const node = this.graph.node(sw.node).pos;
      const state = sim.switches[sw.id] ?? 'normal';
      const selected = state === 'normal' ? sw.normal : sw.reverse;
      const unselected = state === 'normal' ? sw.reverse : sw.normal;

      // Visually disconnect the unselected leg near the frog.
      const u = this.legDirection(sw, unselected);
      g.moveTo(node.x + u.x * 4, node.y + u.y * 4)
        .lineTo(node.x + u.x * BLADE_LENGTH, node.y + u.y * BLADE_LENGTH)
        .stroke({ width: TRACK_WIDTH + 4, color: COLORS.background, cap: 'butt' });

      // Highlight the selected leg as the moving blade.
      const d = this.legDirection(sw, selected);
      g.moveTo(node.x, node.y)
        .lineTo(node.x + d.x * BLADE_LENGTH, node.y + d.y * BLADE_LENGTH)
        .stroke({ width: 4, color: COLORS.switchBlade, cap: 'round' });

      const locked = sim.isSwitchLocked(sw.id);
      g.circle(node.x, node.y, 7).fill(locked ? COLORS.switchLocked : COLORS.switchBlade);
      if (locked) {
        g.circle(node.x, node.y, 11).stroke({ width: 2, color: COLORS.switchLocked, alpha: 0.8 });
      }
    }
  }

  private drawSignalHead(signal: Signal, aspect: Aspect | undefined, held: boolean): void {
    const g = this.signalLayer;
    const node = this.graph.node(signal.node).pos;
    const s = signal.side === 'below' ? 1 : -1;
    const x = node.x;
    const top = s < 0 ? node.y - 44 : node.y + 14;
    if (held) {
      // Dispatcher hold: orange frame around the head and a stop bar across its top.
      g.roundRect(x - 9, top - 3, 18, 36, 7).stroke({ width: 2, color: COLORS.switchLocked });
      g.rect(x - 9, top - 8, 18, 3).fill(COLORS.switchLocked);
    }
    g.moveTo(x, node.y + s * 7)
      .lineTo(x, node.y + s * 14)
      .stroke({ width: 2, color: COLORS.text });
    g.roundRect(x - 6, top, 12, 30, 5)
      .fill(COLORS.signalHead)
      .stroke({
        width: 1,
        color: COLORS.platformEdge,
      });
    const lamps: Aspect[] = ['red', 'yellow', 'green'];
    lamps.forEach((lamp, i) => {
      const y = top + 6 + i * 9;
      const lit = aspect === lamp;
      g.circle(x, y, 3.5).fill({ color: lit ? aspectColor(lamp) : COLORS.signalOff });
      if (lit) g.circle(x, y, 6).fill({ color: aspectColor(lamp), alpha: 0.25 });
    });
  }

  private drawSignals(sim: Simulation): void {
    this.signalLayer.clear();
    for (const signal of this.graph.layout.signals) {
      this.drawSignalHead(signal, sim.aspects.get(signal.id), sim.heldByDispatcher.has(signal.id));
    }
  }

  private trainPolyline(train: Train): Point[] {
    const points: Point[] = [];
    const tail = Math.max(0, train.tailDist);
    const head = Math.min(train.headDist, train.headEdgeEnd);
    for (const entry of train.path) {
      const start = Math.max(tail, entry.start);
      const end = Math.min(head, entry.start + entry.length);
      if (end < start) continue;
      const edge = this.graph.edge(entry.edge);
      if (points.length === 0) points.push(this.graph.pointAlong(edge, start - entry.start));
      points.push(this.graph.pointAlong(edge, end - entry.start));
    }
    return points;
  }

  /** Progress bar under a standing train: fills from tail to head as the dwell elapses. */
  private drawDwellBar(tail: Point, head: Point, progress: number, color: number): void {
    const g = this.trainLayer;
    const y = Math.max(tail.y, head.y) + DWELL_BAR_OFFSET;
    const x0 = Math.min(tail.x, head.x);
    const x1 = Math.max(tail.x, head.x);
    g.roundRect(x0, y - DWELL_BAR_HEIGHT / 2, x1 - x0, DWELL_BAR_HEIGHT, 2).fill({
      color: COLORS.signalHead,
    });
    const fill = (x1 - x0) * Math.min(1, Math.max(0, progress));
    if (fill > 0) {
      g.roundRect(x0, y - DWELL_BAR_HEIGHT / 2, fill, DWELL_BAR_HEIGHT, 2).fill({ color });
    }
  }

  private trainLabel(train: Train): Text {
    let label = this.trainLabels.get(train.id);
    if (!label) {
      label = new Text({
        text: '',
        style: {
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: 12,
          fontWeight: 'bold',
          fill: trainColor(train.plan),
        },
      });
      // Right-aligned so the label trails over the train body and clears the signal at a
      // platform's far end.
      label.anchor.set(1, 1);
      this.labelLayer.addChild(label);
      this.trainLabels.set(train.id, label);
    }
    return label;
  }

  private drawTrains(sim: Simulation): void {
    const g = this.trainLayer;
    g.clear();
    const seen = new Set<string>();
    for (const train of sim.trains) {
      if (train.status === 'left') continue;
      const points = this.trainPolyline(train);
      if (points.length < 2) continue;
      seen.add(train.id);
      const color = trainColor(train.plan);
      const [first, ...rest] = points;
      if (!first) continue;
      g.moveTo(first.x, first.y);
      for (const p of rest) g.lineTo(p.x, p.y);
      g.stroke({ width: TRAIN_WIDTH, color, cap: 'round', join: 'round' });
      const head = points[points.length - 1];
      if (head) g.circle(head.x, head.y, 4).fill(COLORS.trainHead);
      if (train.status === 'dwelling' && first && head && train.plan.dwell > 0) {
        this.drawDwellBar(first, head, 1 - train.dwellRemaining / train.plan.dwell, color);
      }

      const label = this.trainLabel(train);
      const suffix =
        train.status === 'dwelling'
          ? ` ⏱ ${Math.ceil(train.dwellRemaining)}s`
          : train.speed === 0
            ? ' ■'
            : '';
      label.text = `${train.id} → ${train.plan.destination} → ${train.plan.exit}${suffix}`;
      if (head) label.position.set(Math.max(head.x, label.width + 4), head.y - 12);
      label.visible = true;
    }
    for (const [id, label] of this.trainLabels) {
      if (!seen.has(id)) {
        label.destroy();
        this.trainLabels.delete(id);
      }
    }
  }

  private queueLabel(index: number): Text {
    let label = this.queueLabels[index];
    if (!label) {
      label = new Text({
        text: '',
        style: {
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: 10,
          fontWeight: 'bold',
          fill: COLORS.background,
        },
      });
      label.anchor.set(0, 0.5);
      this.labelLayer.addChild(label);
      this.queueLabels[index] = label;
    }
    return label;
  }

  /** Off-stage approach edges in travel order, from the spawn point up to the entrance signal. */
  private approachChain(): EdgeGeometry[] {
    const chain: EdgeGeometry[] = [];
    let edge = this.graph.edge(this.graph.layout.entry);
    const states = this.graph.defaultSwitchStates();
    for (let i = 0; i < 16; i += 1) {
      chain.push(edge);
      if (edge.b.x >= 0) break;
      const next = this.graph.nextEdge(edge.id, states);
      if (next.kind !== 'edge') break;
      edge = next.edge;
    }
    return chain;
  }

  /**
   * The arrival lane above the inbound track. Its lower band is the off-stage approach: one
   * slot per block section, with a pill at each train's real position so queued trains stack
   * up against the entrance signal. Its upper band holds trains not yet on the approach,
   * sliding down as their due time nears.
   */
  private drawUpcoming(sim: Simulation): void {
    const g = this.queueLayer;
    g.clear();
    const chain = this.approachChain();
    const chainLength = chain.reduce((sum, e) => sum + e.length, 0);
    const entrance = chain[chain.length - 1];
    if (!entrance) return;
    const x = entrance.b.x + QUEUE_LEFT_INSET;
    const laneBottom = entrance.b.y - 42;
    const sectionsHeight = chain.length * QUEUE_ROW;
    const sectionsTop = laneBottom - sectionsHeight;
    const etaTop = sectionsTop - QUEUE_ETA_HEIGHT;

    interface Pill {
      plan: ScheduledTrain;
      y: number;
      note: string;
      waiting: boolean;
    }
    const pills: Pill[] = [];
    // Trains on the approach: pill position mirrors the head position along the sections.
    const chainIds = new Set(chain.map((e) => e.id));
    for (const train of sim.trains) {
      if (train.status === 'left' || !chainIds.has(train.headEntry.edge)) continue;
      const remaining = Math.max(0, chainLength - train.headDist);
      pills.push({
        plan: train.plan,
        y: laneBottom - (remaining / chainLength) * sectionsHeight,
        note: train.speed === 0 ? 'held' : '▼',
        waiting: train.speed === 0,
      });
    }
    // Trains not yet on the approach: slide down the upper band as their due time nears,
    // never overlapping a train that has just entered the top approach section.
    let floor = Math.min(sectionsTop + QUEUE_ROW, ...pills.map((p) => p.y));
    for (const plan of sim.pending) {
      const due = plan.at - sim.time;
      const progress = Math.min(1, Math.max(0, due) / QUEUE_HORIZON_SECONDS);
      let y = sectionsTop - progress * QUEUE_ETA_HEIGHT;
      y = Math.min(y, floor - QUEUE_ROW);
      floor = y;
      pills.push({
        plan,
        y,
        note: due <= 0 ? 'waiting' : `${Math.ceil(due)}s`,
        waiting: due <= 0,
      });
    }
    const shown = pills.slice(0, chain.length + QUEUE_MAX_PENDING);
    const hidden = pills.length - shown.length;

    // Approach track: a vertical line with one block signal dot per section boundary.
    const trackX = x - 10;
    g.moveTo(trackX, laneBottom + QUEUE_ROW / 2)
      .lineTo(trackX, sectionsTop + QUEUE_ROW / 2)
      .stroke({ width: 2, color: COLORS.trackIdle });
    let boundary = sectionsTop + QUEUE_ROW / 2;
    for (const edge of chain) {
      boundary += (edge.length / chainLength) * sectionsHeight;
      const signal = this.graph.signalByFromEdge.get(edge.id);
      const aspect = signal ? sim.aspects.get(signal.id) : undefined;
      g.circle(trackX, boundary - QUEUE_ROW / 2, 3).fill(aspectColor(aspect));
    }

    let labelIndex = 0;
    const header = this.queueLabel(labelIndex);
    labelIndex += 1;
    header.anchor.set(0, 0.5);
    header.style.fill = COLORS.text;
    header.text = hidden > 0 ? `+${hidden} MORE` : shown.length > 0 ? 'NEXT' : 'NO MORE TRAINS';
    header.position.set(x, Math.min(etaTop, ...shown.map((p) => p.y)) - QUEUE_HEIGHT - 8);
    header.visible = true;

    for (const pill of shown) {
      const color = trainColor(pill.plan);
      g.roundRect(x, pill.y - QUEUE_HEIGHT / 2, QUEUE_WIDTH, QUEUE_HEIGHT, 4).fill({
        color,
        alpha: pill.waiting ? 1 : 0.85,
      });
      if (pill.waiting) {
        g.roundRect(
          x - 2,
          pill.y - QUEUE_HEIGHT / 2 - 2,
          QUEUE_WIDTH + 4,
          QUEUE_HEIGHT + 4,
          5,
        ).stroke({ width: 1.5, color: COLORS.textBright });
      }
      const label = this.queueLabel(labelIndex);
      labelIndex += 1;
      label.anchor.set(0, 0.5);
      label.style.fill = COLORS.background;
      label.text = `${pill.plan.id} → ${pill.plan.destination}/${pill.plan.exit}`;
      label.position.set(x + 6, pill.y);
      label.visible = true;

      const note = this.queueLabel(labelIndex);
      labelIndex += 1;
      note.anchor.set(1, 0.5);
      note.style.fill = COLORS.background;
      note.text = pill.note;
      note.position.set(x + QUEUE_WIDTH - 6, pill.y);
      note.visible = true;
    }

    for (let i = labelIndex; i < this.queueLabels.length; i += 1) {
      const label = this.queueLabels[i];
      if (label) label.visible = false;
    }
  }

  // ---------------------------------------------------------------------------------------

  /** Turn new money events into floating `+$` / `-$` labels that leave the train. */
  private spawnMoneyPopups(sim: Simulation): void {
    const { events } = sim;
    let burst = 0;
    for (; this.eventCursor < events.length; this.eventCursor += 1) {
      const event = events[this.eventCursor];
      if (event?.kind !== 'money') continue;
      if (event.reason === 'wrong-exit' || event.reason === 'missed-stop') {
        const origin = this.exitEdgePoint(event.exit);
        if (origin) this.wrongExitPopup(event.amount, origin, burst);
        burst += 1;
        continue;
      }
      const train = sim.trains.find((t) => t.id === event.train);
      if (!train) continue;
      const points = this.trainPolyline(train);
      const origin =
        event.reason === 'late' ? points[points.length - 1] : this.randomPointOn(points);
      if (origin) this.risingPopup(event.amount, this.clampToStage(origin));
    }
  }

  private moneyText(amount: number): Text {
    const text = new Text({
      text: amount >= 0 ? `+$${amount}` : `-$${-amount}`,
      style: {
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: 13,
        fontWeight: 'bold',
        fill: amount >= 0 ? COLORS.moneyUp : COLORS.moneyDown,
        stroke: { color: COLORS.background, width: 3 },
      },
    });
    text.anchor.set(0.5);
    this.moneyLayer.addChild(text);
    return text;
  }

  /** A coin label that pops off the train and floats up while fading out. */
  private risingPopup(amount: number, origin: Point): void {
    const text = this.moneyText(amount);
    text.position.set(origin.x, origin.y - 8);
    text.scale.set(0.4);
    gsap.to(text.scale, { x: 1, y: 1, duration: 0.25, ease: 'back.out(3)' });
    gsap.to(text, {
      y: origin.y - 44 - Math.random() * 10,
      x: origin.x + (Math.random() - 0.5) * 14,
      duration: 1.3,
      ease: 'power2.out',
    });
    gsap.to(text, {
      alpha: 0,
      duration: 0.5,
      delay: 0.8,
      ease: 'power1.in',
      onComplete: () => text.destroy(),
    });
  }

  /** A refund label that flies back into the station from the exit point the train crosses. */
  private wrongExitPopup(amount: number, origin: Point, index: number): void {
    const text = this.moneyText(amount);
    const inward = origin.x >= STAGE_WIDTH / 2 ? -1 : 1;
    text.position.set(origin.x, origin.y);
    text.alpha = 0;
    text.scale.set(1.3);
    const delay = index * 0.09;
    gsap.to(text, { alpha: 1, duration: 0.12, delay });
    gsap.to(text.scale, { x: 1, y: 1, duration: 0.4, delay, ease: 'power2.out' });
    gsap.to(text, {
      x: origin.x + inward * (50 + Math.random() * 70),
      y: origin.y + (Math.random() - 0.5) * 70,
      duration: 1.1,
      delay,
      ease: 'power3.out',
    });
    gsap.to(text, {
      alpha: 0,
      duration: 0.5,
      delay: delay + 1,
      onComplete: () => text.destroy(),
    });
  }

  /** The exit point: the far end of the exit track, where trains leave the layout. */
  private exitEdgePoint(exitId: string | undefined): Point | undefined {
    const exit = this.graph.layout.exits.find((x) => x.id === exitId);
    if (!exit) return undefined;
    return this.clampToStage(this.graph.edge(exit.edge).b);
  }

  private clampToStage(p: Point): Point {
    return {
      x: Math.min(STAGE_WIDTH - MONEY_EDGE_INSET, Math.max(MONEY_EDGE_INSET, p.x)),
      y: Math.min(STAGE_HEIGHT - MONEY_EDGE_INSET, Math.max(MONEY_EDGE_INSET, p.y)),
    };
  }

  /** A uniformly random point along a polyline (the train body). */
  private randomPointOn(points: Point[]): Point | undefined {
    const segments = points.slice(1).map((b, i) => {
      const a = points[i] ?? b;
      return { a, b, length: Math.hypot(b.x - a.x, b.y - a.y) };
    });
    const total = segments.reduce((sum, seg) => sum + seg.length, 0);
    let r = Math.random() * total;
    for (const seg of segments) {
      if (r <= seg.length && seg.length > 0) {
        const t = r / seg.length;
        return { x: seg.a.x + (seg.b.x - seg.a.x) * t, y: seg.a.y + (seg.b.y - seg.a.y) * t };
      }
      r -= seg.length;
    }
    return points[points.length - 1];
  }
}
