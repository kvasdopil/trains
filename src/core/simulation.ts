import { TrackGraph } from './graph';
import { computeAspects, routeAhead } from './signals';
import { DEFAULT_PHYSICS, PLATFORM_PASS_SPEED_FACTOR, STOP_MARGIN, Train } from './train';
import type { TrainPhysics } from './train';
import { DEFAULT_PLATFORM_MARGIN } from './types';
import type {
  Aspect,
  EdgeId,
  ExitId,
  PlatformId,
  ScheduledTrain,
  SignalId,
  StationLayout,
  SwitchId,
  SwitchState,
  TrackId,
  TrainId,
} from './types';

export interface SimulationOptions {
  physics?: TrainPhysics;
  /** Seconds a train is expected to need from entry to exit, excluding its dwell. */
  nominalTripSeconds?: number;
  /** Seconds of lateness that are forgiven before delay penalties apply. */
  delayGraceSeconds?: number;
}

export interface TrainResult {
  id: TrainId;
  booked: TrackId;
  /** Platform the train stopped at, or null if it never stopped. */
  servedPlatform: PlatformId | null;
  /** True if the train ran along a through track. */
  viaThrough: boolean;
  bookedExit: ExitId;
  exitTaken: ExitId | null;
  /** Stopping train stopped at its booked platform, or through train never stopped (any route). */
  correct: boolean;
  correctExit: boolean;
  delaySeconds: number;
  points: number;
  exitedAt: number;
}

export type GameEvent =
  | {
      time: number;
      kind: 'arrival';
      train: TrainId;
      destination: TrackId;
      exit: ExitId;
      through: boolean;
    }
  | { time: number; kind: 'stopped'; train: TrainId; platform: PlatformId; correct: boolean }
  | { time: number; kind: 'departed'; train: TrainId; platform: PlatformId }
  /** A train entered a through track, or a platform it will not stop at. */
  | { time: number; kind: 'passing'; train: TrainId; track: TrackId; correct: boolean }
  | {
      time: number;
      kind: 'left';
      train: TrainId;
      points: number;
      correct: boolean;
      exit: ExitId | null;
      correctExit: boolean;
    }
  | { time: number; kind: 'switch'; switchId: SwitchId; state: SwitchState }
  | { time: number; kind: 'signal-hold'; signalId: SignalId; held: boolean }
  | { time: number; kind: 'switch-locked'; switchId: SwitchId };

interface StopTarget {
  /** Distance from the head to the exact point where it must stop. */
  dist: number;
  reason: 'platform' | 'signal' | 'blocked' | 'none';
  platform?: PlatformId;
  /** First speed-restricted edge ahead (a platform for a non-stopping train), if any. */
  limitAhead?: { dist: number; speed: number };
}

const MAX_LOOKAHEAD_EDGES = 32;
const DEFAULT_NOMINAL_TRIP = 30;
const DEFAULT_GRACE = 8;
const POINTS_CORRECT = 100;
const POINTS_WRONG = -50;
const POINTS_WRONG_EXIT = -50;
const POINTS_PER_LATE_SECOND = -2;

/**
 * Pure, deterministic station simulation. It owns switch states, trains, signals and
 * scoring. Rendering and input live outside; they call `toggleSwitch` and `step`.
 */
export class Simulation {
  readonly graph: TrackGraph;
  readonly schedule: readonly ScheduledTrain[];
  readonly physics: TrainPhysics;
  readonly nominalTripSeconds: number;
  readonly delayGraceSeconds: number;

  time = 0;
  score = 0;
  switches: Record<SwitchId, SwitchState>;
  trains: Train[] = [];
  pending: ScheduledTrain[];
  results: TrainResult[] = [];
  events: GameEvent[] = [];

  /** Signals the dispatcher has manually held at red. */
  readonly heldByDispatcher = new Set<SignalId>();

  /** Derived state from the last `step`; refreshed before trains move. */
  aspects = new Map<SignalId, Aspect>();
  occupied = new Set<EdgeId>();
  locked = new Set<EdgeId>();

  constructor(layout: StationLayout, schedule: ScheduledTrain[], options: SimulationOptions = {}) {
    this.graph = new TrackGraph(layout);
    this.schedule = schedule;
    this.physics = options.physics ?? DEFAULT_PHYSICS;
    this.nominalTripSeconds = options.nominalTripSeconds ?? DEFAULT_NOMINAL_TRIP;
    this.delayGraceSeconds = options.delayGraceSeconds ?? DEFAULT_GRACE;
    this.switches = this.graph.defaultSwitchStates();
    this.pending = [...schedule].sort((a, b) => a.at - b.at);
    for (const plan of this.pending) {
      this.graph.isStoppingDestination(plan.destination);
      if (!this.graph.exitById.has(plan.exit)) throw new Error(`Unknown exit ${plan.exit}`);
    }
    this.refreshDerivedState();
  }

  get finished(): boolean {
    return this.pending.length === 0 && this.trains.every((t) => t.status === 'left');
  }

  get activeTrains(): Train[] {
    return this.trains.filter((t) => t.status !== 'left');
  }

  /** Edges that are either occupied or route-locked. */
  get blocked(): Set<EdgeId> {
    return new Set([...this.occupied, ...this.locked]);
  }

  isSwitchLocked(id: SwitchId): boolean {
    const sw = this.graph.switches.get(id);
    if (!sw) throw new Error(`Unknown switch ${id}`);
    const blocked = this.blocked;
    return this.graph.switchEdges(sw).some((e) => blocked.has(e));
  }

  /** Throw a switch. Returns false (and logs an event) when the switch is locked. */
  toggleSwitch(id: SwitchId): boolean {
    if (this.isSwitchLocked(id)) {
      this.events.push({ time: this.time, kind: 'switch-locked', switchId: id });
      return false;
    }
    const next: SwitchState = this.switches[id] === 'normal' ? 'reverse' : 'normal';
    this.switches[id] = next;
    this.events.push({ time: this.time, kind: 'switch', switchId: id, state: next });
    this.refreshDerivedState();
    return true;
  }

  /** Hold a signal at red, or release it. Trains already past it are unaffected. */
  toggleSignalHold(id: SignalId): boolean {
    if (!this.graph.layout.signals.some((s) => s.id === id))
      throw new Error(`Unknown signal ${id}`);
    const held = !this.heldByDispatcher.has(id);
    if (held) this.heldByDispatcher.add(id);
    else this.heldByDispatcher.delete(id);
    this.events.push({ time: this.time, kind: 'signal-hold', signalId: id, held });
    this.refreshDerivedState();
    return held;
  }

  /** Advance the simulation by `dt` seconds. */
  step(dt: number): void {
    if (dt <= 0) return;
    this.spawnDueTrains();
    this.refreshDerivedState();
    for (const train of this.trains) {
      if (train.status === 'left') continue;
      this.advanceTrain(train, dt);
    }
    this.time += dt;
  }

  // ---------------------------------------------------------------------------------------

  /**
   * Signals held at red by the dispatcher. A starter is not held while its train is still
   * loading: it shows the real state of the route ahead, so green means "good to go as soon
   * as the doors close".
   */
  private heldSignals(): Set<SignalId> {
    return new Set<SignalId>(this.heldByDispatcher);
  }

  private refreshDerivedState(): void {
    this.occupied = new Set<EdgeId>();
    this.locked = new Set<EdgeId>();
    for (const train of this.trains) {
      if (train.status === 'left') continue;
      for (const e of train.occupiedEdges()) this.occupied.add(e);
      for (const e of train.lock) this.locked.add(e);
    }
    this.aspects = computeAspects(this.graph, {
      states: this.switches,
      blocked: this.blocked,
      held: this.heldSignals(),
    });
  }

  private spawnDueTrains(): void {
    const entry = this.graph.edge(this.graph.layout.entry);
    while (this.pending.length > 0) {
      const next = this.pending[0];
      if (!next || next.at > this.time) break;
      if (this.occupied.has(entry.id) || this.locked.has(entry.id)) break;
      this.pending.shift();
      const stops = this.graph.isStoppingDestination(next.destination);
      const train = new Train(next, entry, this.time, this.physics, stops);
      this.trains.push(train);
      this.events.push({
        time: this.time,
        kind: 'arrival',
        train: train.id,
        destination: next.destination,
        exit: next.exit,
        through: !stops,
      });
      this.occupied.add(entry.id);
    }
  }

  private findStopTarget(train: Train): StopTarget {
    const { graph } = this;
    let edgeId = train.headEntry.edge;
    let dist = train.headEdgeEnd - train.headDist;
    if (train.atExit) return { dist: Infinity, reason: 'none' };
    let limitAhead: StopTarget['limitAhead'];
    const withLimit = (target: StopTarget): StopTarget =>
      limitAhead ? { ...target, limitAhead } : target;
    for (let i = 0; i < MAX_LOOKAHEAD_EDGES; i += 1) {
      const platform = graph.platformByEdge.get(edgeId);
      if (platform && train.stops && train.servedPlatform === null) {
        const margin = platform.margin ?? DEFAULT_PLATFORM_MARGIN;
        return withLimit({ dist: dist - margin, reason: 'platform', platform: platform.id });
      }
      const signal = graph.signalByFromEdge.get(edgeId);
      if (signal && this.aspects.get(signal.id) === 'red') {
        return withLimit({ dist: dist - STOP_MARGIN, reason: 'signal' });
      }
      const next = graph.nextEdge(edgeId, this.switches);
      if (next.kind === 'blocked') {
        return withLimit({ dist: dist - STOP_MARGIN, reason: 'blocked' });
      }
      if (next.kind === 'exit') return withLimit({ dist: Infinity, reason: 'none' });
      if (!limitAhead && !train.stops && graph.platformByEdge.has(next.edge.id)) {
        limitAhead = { dist, speed: train.physics.maxSpeed * PLATFORM_PASS_SPEED_FACTOR };
      }
      dist += next.edge.length;
      edgeId = next.edge.id;
    }
    return withLimit({ dist, reason: 'none' });
  }

  /** Speed limit on the train's current edge: through trains crawl along platform tracks. */
  private speedLimit(train: Train): number {
    const { maxSpeed } = train.physics;
    if (!train.stops && this.graph.platformByEdge.has(train.headEntry.edge)) {
      return maxSpeed * PLATFORM_PASS_SPEED_FACTOR;
    }
    return maxSpeed;
  }

  private advanceTrain(train: Train, dt: number): void {
    if (train.status === 'dwelling') {
      train.dwellRemaining -= dt;
      if (train.dwellRemaining <= 0) {
        train.dwellRemaining = 0;
        train.status = 'running';
        this.events.push({
          time: this.time,
          kind: 'departed',
          train: train.id,
          platform: train.servedPlatform ?? '?',
        });
        this.refreshDerivedState();
      }
      return;
    }

    const target = this.findStopTarget(train);
    const stopDist = Math.max(0, target.dist);
    const { acceleration, deceleration } = train.physics;
    const brakingSpeed = Math.sqrt(2 * deceleration * stopDist);
    // Brake early enough to be at the restricted speed when the restricted edge begins.
    const limitSpeed = target.limitAhead
      ? Math.sqrt(target.limitAhead.speed ** 2 + 2 * deceleration * target.limitAhead.dist)
      : Infinity;
    const targetSpeed = Math.min(this.speedLimit(train), brakingSpeed, limitSpeed);
    if (targetSpeed > train.speed) {
      train.speed = Math.min(train.speed + acceleration * dt, targetSpeed);
    } else {
      train.speed = Math.max(train.speed - deceleration * dt, targetSpeed);
    }
    const move = Math.min(train.speed * dt, stopDist);
    train.headDist += move;

    this.crossEdgeBoundaries(train);
    train.prune();

    if (target.reason === 'platform' && target.platform && stopDist - move <= 1e-6) {
      train.speed = 0;
      train.status = 'dwelling';
      train.dwellRemaining = train.plan.dwell;
      train.servedPlatform = target.platform;
      const correct = target.platform === train.plan.destination;
      this.events.push({
        time: this.time,
        kind: 'stopped',
        train: train.id,
        platform: target.platform,
        correct,
      });
      this.refreshDerivedState();
      return;
    }

    if (train.atExit && train.tailDist >= train.headEdgeEnd) {
      this.completeTrain(train);
    }
  }

  /** Move the head onto following edges, locking routes as signals are passed. */
  private crossEdgeBoundaries(train: Train): void {
    while (!train.atExit && train.headDist >= train.headEdgeEnd) {
      const current = train.headEntry;
      const next = this.graph.nextEdge(current.edge, this.switches);
      if (next.kind === 'blocked') {
        // Safety stop: should be unreachable because the stop target halts the train first.
        train.headDist = train.headEdgeEnd - STOP_MARGIN;
        train.speed = 0;
        return;
      }
      const signal = this.graph.signalByFromEdge.get(current.edge);
      if (signal) {
        const route = routeAhead(this.graph, signal, this.switches);
        train.lock = new Set(route.edges);
        for (const e of route.edges) this.locked.add(e);
        // Re-evaluate at once so another train whose route conflicts with this one (for
        // example across a diamond crossing) sees red in the same step.
        this.aspects = computeAspects(this.graph, {
          states: this.switches,
          blocked: this.blocked,
          held: this.heldSignals(),
        });
      }
      if (next.kind === 'exit') {
        train.atExit = true;
        return;
      }
      train.path.push({ edge: next.edge.id, start: train.headEdgeEnd, length: next.edge.length });
      this.occupied.add(next.edge.id);
      this.noteTrackEntered(train, next.edge.id);
    }
  }

  /** Log when a train enters a through track, a platform it will not stop at, or an exit. */
  private noteTrackEntered(train: Train, edge: EdgeId): void {
    const exit = this.graph.exitByEdge.get(edge);
    if (exit) {
      train.exitTaken = exit.id;
      return;
    }
    const through = this.graph.throughByEdge.get(edge);
    if (through) {
      train.viaThrough = true;
      // A stopping train on the through line is going to miss its stop.
      this.events.push({
        time: this.time,
        kind: 'passing',
        train: train.id,
        track: through.id,
        correct: !train.stops,
      });
      return;
    }
    const platform = this.graph.platformByEdge.get(edge);
    if (platform && !train.stops) {
      // Through trains may run through any platform, as long as they never stop.
      this.events.push({
        time: this.time,
        kind: 'passing',
        train: train.id,
        track: platform.id,
        correct: true,
      });
    }
  }

  private completeTrain(train: Train): void {
    train.status = 'left';
    train.exitedAt = this.time;
    train.lock.clear();
    const expectedExit = train.plan.at + this.nominalTripSeconds + train.plan.dwell;
    const delaySeconds = Math.max(0, this.time - expectedExit);
    const correct = train.stops
      ? train.servedPlatform === train.plan.destination
      : train.servedPlatform === null;
    const correctExit = train.exitTaken === train.plan.exit;
    const latePenalty =
      Math.floor(Math.max(0, delaySeconds - this.delayGraceSeconds)) * POINTS_PER_LATE_SECOND;
    const points =
      (correct ? POINTS_CORRECT : POINTS_WRONG) +
      (correctExit ? 0 : POINTS_WRONG_EXIT) +
      latePenalty;
    this.score += points;
    this.results.push({
      id: train.id,
      booked: train.plan.destination,
      servedPlatform: train.servedPlatform,
      viaThrough: train.viaThrough,
      bookedExit: train.plan.exit,
      exitTaken: train.exitTaken,
      correct,
      correctExit,
      delaySeconds,
      points,
      exitedAt: this.time,
    });
    this.events.push({
      time: this.time,
      kind: 'left',
      train: train.id,
      points,
      correct,
      exit: train.exitTaken,
      correctExit,
    });
    this.refreshDerivedState();
  }
}
