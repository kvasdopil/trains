import type { SwitchStates, TrackGraph } from './graph';
import type { Aspect, EdgeId, Signal, SignalId } from './types';

export interface RouteAhead {
  /** Edges from the signal up to and including the `fromEdge` of the next signal. */
  edges: EdgeId[];
  /** Extra edges that must also be clear: the other track of every crossing on the route. */
  conflicts: EdgeId[];
  /** `ok` when the route reaches a signal or the exit; `blocked` when a switch is against it. */
  status: 'ok' | 'blocked';
  nextSignal: Signal | null;
}

const MAX_ROUTE_EDGES = 64;

/**
 * Walk the track ahead of a signal following the current switch positions. The walk ends
 * at the next signal (whose `fromEdge` is the last edge walked), at the exit, or when a
 * switch is set against the movement.
 */
export function routeAhead(graph: TrackGraph, signal: Signal, states: SwitchStates): RouteAhead {
  const edges: EdgeId[] = [];
  const conflicts = new Set<EdgeId>();
  const done = (status: RouteAhead['status'], nextSignal: Signal | null): RouteAhead => {
    for (const e of edges) conflicts.delete(e);
    return { edges, conflicts: [...conflicts], status, nextSignal };
  };
  let current = signal.fromEdge;
  for (let i = 0; i < MAX_ROUTE_EDGES; i += 1) {
    const next = graph.nextEdge(current, states);
    if (next.kind === 'blocked') return done('blocked', null);
    if (next.kind === 'exit') return done('ok', null);
    edges.push(next.edge.id);
    current = next.edge.id;
    const crossing = graph.crossingByEdge.get(current);
    if (crossing) for (const e of graph.crossingEdges(crossing)) conflicts.add(e);
    const nextSignal = graph.signalByFromEdge.get(current);
    if (nextSignal) return done('ok', nextSignal);
  }
  return done('blocked', null);
}

export interface AspectInput {
  states: SwitchStates;
  /** Edges that are occupied by, or route-locked for, any train. */
  blocked: ReadonlySet<EdgeId>;
  /** Signals held at red (e.g. a platform starter while a train dwells). */
  held: ReadonlySet<SignalId>;
}

/**
 * Three-aspect block signalling:
 * - red:    the section ahead (or the other track of a crossing on it) is occupied/locked,
 *           a switch is against the route, or the signal is held;
 * - yellow: the section ahead is clear but the next signal shows red;
 * - green:  the section ahead is clear and the next signal shows yellow or green (or there is none).
 */
export function computeAspects(graph: TrackGraph, input: AspectInput): Map<SignalId, Aspect> {
  const result = new Map<SignalId, Aspect>();
  const visiting = new Set<SignalId>();

  const evaluate = (signal: Signal): Aspect => {
    const cached = result.get(signal.id);
    if (cached) return cached;
    if (visiting.has(signal.id)) return 'red';
    visiting.add(signal.id);

    let aspect: Aspect;
    if (input.held.has(signal.id)) {
      aspect = 'red';
    } else {
      const route = routeAhead(graph, signal, input.states);
      const sectionBlocked =
        route.edges.some((e) => input.blocked.has(e)) ||
        route.conflicts.some((e) => input.blocked.has(e));
      if (route.status === 'blocked' || sectionBlocked) {
        aspect = 'red';
      } else if (route.nextSignal) {
        aspect = evaluate(route.nextSignal) === 'red' ? 'yellow' : 'green';
      } else {
        aspect = 'green';
      }
    }

    visiting.delete(signal.id);
    result.set(signal.id, aspect);
    return aspect;
  };

  for (const signal of graph.layout.signals) evaluate(signal);
  return result;
}
