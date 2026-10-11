import { TrackGraph } from './graph';
import { computeAspects, routeAhead } from './signals';
import {
  DEFAULT_PHYSICS,
  EXPRESS_PHYSICS,
  PLATFORM_PASS_SPEED_FACTOR,
  STOP_MARGIN,
  Train,
} from './train';
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
  /** Physics for express trains. */
  expressPhysics?: TrainPhysics;
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
  /** Net money this train earned: fare minus compensation and lateness charges. */
  earned: number;
  exitedAt: number;
}

/**
 * Why money changed. Each change is one coin with a visible origin on the train:
 * `unload` and `through` come off the train body, `late` off its head, and the refunds
 * `missed-stop` and `wrong-exit` off the exit point as the train crosses it.
 */
export type MoneyReason = 'unload' | 'through' | 'missed-stop' | 'late' | 'wrong-exit';

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
      earned: number;
      correct: boolean;
      exit: ExitId | null;
      correctExit: boolean;
    }
  | { time: number; kind: 'switch'; switchId: SwitchId; state: SwitchState }
  | { time: number; kind: 'signal-hold'; signalId: SignalId; held: boolean }
  | { time: number; kind: 'switch-locked'; switchId: SwitchId }
  | {
      time: number;
      kind: 'money';
      train: TrainId;
      amount: number;
      reason: MoneyReason;
      /** Exit the train left by, for `wrong-exit` coins. */
      exit?: ExitId;
    };

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
/** Value of one fare coin. */
export const COIN = 10;
/** Coins a train pays when it unloads at its booked platform, or runs through as booked. */
export const FARE_COINS = 10;
/** Coins a train pays when it unloads at the wrong platform (half the fare). */
export const WRONG_PLATFORM_COINS = 5;
/** Coins refunded when a train leaves by the wrong exit: passengers get the full fare back. */
export const WRONG_EXIT_COINS = FARE_COINS;
/** Coins refunded when a stopping train leaves without stopping (sent down the through line). */
export const MISSED_STOP_COINS = FARE_COINS;
/** Charged every whole second a train on the layout runs late beyond the grace. */
export const LATE_CHARGE_PER_SECOND = 2;
/** An express multiplies every coin it earns or costs by this. */
export const EXPRESS_MULTIPLIER = 3;

/**
 * Pure, deterministic station simulation. It owns switch states, trains, signals and
 * money. Rendering and input live outside; they call `toggleSwitch` and `step`.
 */
export class Simulation {
  readonly graph: TrackGraph;
  readonly schedule: readonly ScheduledTrain[];
  readonly physics: TrainPhysics;
  readonly expressPhysics: TrainPhysics;
  readonly nominalTripSeconds: number;
  readonly delayGraceSeconds: number;

  time = 0;
  money = 0;
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
    this.expressPhysics = options.expressPhysics ?? EXPRESS_PHYSICS;
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
      this.payFareRun(train);
      this.payRefunds(train);
    }
    this.time += dt;
    for (const train of this.trains) {
      if (train.status !== 'left') this.chargeLateness(train);
    }
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
      const physics = next.express ? this.expressPhysics : this.physics;
      const train = new Train(next, entry, this.time, physics, stops);
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
      this.payUnloading(train);
      if (train.dwellRemaining <= 0) {
        train.dwellRemaining = 0;
        this.payUnloading(train);
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
    // Held up by the dispatcher: braking for (or standing at) a red signal or unset route.
    const held =
      (target.reason === 'signal' || target.reason === 'blocked') &&
      brakingSpeed < this.speedLimit(train);
    if (held) train.heldSeconds += dt;
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
        const refunds = this.refundCoins(train);
        if (refunds.missedStop + refunds.wrongExit > 0) train.refundFrom = train.headEdgeEnd;
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
      this.startFareRun(train, edge);
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
      this.startFareRun(train, edge);
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

  /** Fare coins a train pays in total: the full fare, or half at the wrong platform. */
  private fareCoins(train: Train): number {
    if (!train.stops) return FARE_COINS;
    return train.servedPlatform === train.plan.destination ? FARE_COINS : WRONG_PLATFORM_COINS;
  }

  private addMoney(train: Train, amount: number, reason: MoneyReason, exit?: ExitId): void {
    this.money += amount;
    train.earned += amount;
    this.events.push({
      time: this.time,
      kind: 'money',
      train: train.id,
      amount,
      reason,
      ...(exit ? { exit } : {}),
    });
  }

  /** Passengers leave a dwelling train coin by coin, spread evenly across the dwell. */
  private payUnloading(train: Train): void {
    const coins = this.fareCoins(train);
    const dwell = train.plan.dwell;
    const elapsed = dwell - train.dwellRemaining;
    const due = dwell > 0 ? Math.min(coins, Math.floor((elapsed / dwell) * coins + 1e-9)) : coins;
    while (train.coinsPaid < due) {
      train.coinsPaid += 1;
      this.addMoney(train, this.coin(train), 'unload');
    }
  }

  /** Along the first through or platform track a through train runs on, it earns its fare. */
  private startFareRun(train: Train, edge: EdgeId): void {
    if (train.fareRun || train.stops) return;
    const edgeLength = this.graph.edge(edge).length;
    train.fareRun = {
      start: train.headEdgeEnd - edgeLength + DEFAULT_PLATFORM_MARGIN,
      length: edgeLength - 2 * DEFAULT_PLATFORM_MARGIN,
    };
  }

  /** Pay the coins due so far on the train's fare run; `finish` pays out the remainder. */
  private payFareRun(train: Train, finish = false): void {
    const run = train.fareRun;
    if (!run || train.status === 'left') return;
    const progress = finish ? 1 : (train.headDist - run.start) / run.length;
    const due = Math.min(FARE_COINS, Math.max(0, Math.floor(progress * FARE_COINS + 1e-9)));
    while (train.coinsPaid < due) {
      train.coinsPaid += 1;
      this.addMoney(train, this.coin(train), 'through');
    }
  }

  /** Refund coins a train owes as it leaves: the fare for a missed stop and for a wrong exit. */
  private refundCoins(train: Train): { missedStop: number; wrongExit: number } {
    return {
      missedStop: train.stops && train.servedPlatform === null ? MISSED_STOP_COINS : 0,
      wrongExit: train.exitTaken === train.plan.exit ? 0 : WRONG_EXIT_COINS,
    };
  }

  /**
   * Refunds are paid coin by coin as the train crosses the exit point, from the head reaching
   * it until the tail clears it: missed-stop coins first, then wrong-exit coins. `finish` pays
   * the remainder.
   */
  private payRefunds(train: Train, finish = false): void {
    const from = train.refundFrom;
    if (from === null || train.status === 'left') return;
    const { missedStop, wrongExit } = this.refundCoins(train);
    const total = missedStop + wrongExit;
    const progress = finish ? 1 : (train.headDist - from) / train.length;
    const due = Math.min(total, Math.max(0, Math.floor(progress * total)));
    while (train.refundCoinsPaid < due) {
      const reason = train.refundCoinsPaid < missedStop ? 'missed-stop' : 'wrong-exit';
      train.refundCoinsPaid += 1;
      this.addMoney(train, -this.coin(train), reason, train.exitTaken ?? undefined);
    }
  }

  /** Shift second by which the train should have left, including the grace. */
  private deadline(train: Train): number {
    return train.plan.at + this.nominalTripSeconds + train.plan.dwell;
  }

  /**
   * Every whole second a train on the layout runs past its deadline plus grace costs money.
   * An express has no grace, pays triple, and is also charged for every second it is held up
   * at a signal, starting the moment it has to brake.
   */
  private chargeLateness(train: Train): void {
    const grace = train.plan.express ? 0 : this.delayGraceSeconds;
    let overdue = Math.floor(this.time - this.deadline(train) - grace + 1e-9);
    // An express is late the moment it is held up: one charge as it starts braking or stops,
    // then one per further second held.
    if (train.plan.express) overdue = Math.max(overdue, Math.ceil(train.heldSeconds - 1e-9));
    while (train.lateCharged < overdue) {
      train.lateCharged += 1;
      this.addMoney(train, -LATE_CHARGE_PER_SECOND * this.multiplier(train), 'late');
    }
  }

  private multiplier(train: Train): number {
    return train.plan.express ? EXPRESS_MULTIPLIER : 1;
  }

  /** Value of one fare or refund coin for this train. */
  private coin(train: Train): number {
    return COIN * this.multiplier(train);
  }

  private completeTrain(train: Train): void {
    this.payFareRun(train, true);
    this.payRefunds(train, true);
    train.status = 'left';
    train.exitedAt = this.time;
    train.lock.clear();
    const delaySeconds = Math.max(0, this.time - this.deadline(train));
    const correct = train.stops
      ? train.servedPlatform === train.plan.destination
      : train.servedPlatform === null;
    const correctExit = train.exitTaken === train.plan.exit;
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
      earned: train.earned,
      exitedAt: this.time,
    });
    this.events.push({
      time: this.time,
      kind: 'left',
      train: train.id,
      earned: train.earned,
      correct,
      exit: train.exitTaken,
      correctExit,
    });
    this.refreshDerivedState();
  }
}
