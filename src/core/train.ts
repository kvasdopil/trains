import type { EdgeGeometry } from './graph';
import type { EdgeId, PlatformId, ScheduledTrain, TrainId } from './types';

/** Speed factor applied to a non-stopping train while it runs along a platform track. */
export const PLATFORM_PASS_SPEED_FACTOR = 0.45;

/** A traversed edge and the cumulative distance (from spawn) at which it starts. */
export interface PathEntry {
  edge: EdgeId;
  start: number;
  length: number;
}

export type TrainStatus =
  /** On the tracks, moving or waiting at a signal. */
  | 'running'
  /** Standing at a platform for the booked dwell time. */
  | 'dwelling'
  /** Has left the layout; kept for the result record. */
  | 'left';

export interface TrainPhysics {
  /** Maximum speed, track units per second. */
  maxSpeed: number;
  acceleration: number;
  deceleration: number;
}

export const DEFAULT_PHYSICS: TrainPhysics = {
  maxSpeed: 110,
  acceleration: 35,
  deceleration: 55,
};

/** Expresses run more than twice as fast, and accelerate and brake harder to match. */
export const EXPRESS_PHYSICS: TrainPhysics = {
  maxSpeed: 240,
  acceleration: 60,
  deceleration: 95,
};

/** Trains stop this far short of a signal or platform end. */
export const STOP_MARGIN = 3;

export class Train {
  readonly id: TrainId;
  readonly plan: ScheduledTrain;
  readonly physics: TrainPhysics;
  readonly spawnedAt: number;
  /** True for passenger trains that must stop at a platform; false for through trains. */
  readonly stops: boolean;

  /** Edges traversed so far that still carry some part of the train (plus the head edge). */
  path: PathEntry[];
  /** Distance travelled by the head since spawning. */
  headDist = 0;
  speed = 0;
  status: TrainStatus = 'running';
  dwellRemaining = 0;
  servedPlatform: PlatformId | null = null;
  /** True once the train has run onto a through track. */
  viaThrough = false;
  /** Exit the train left (or is leaving) by, once it has entered an exit track. */
  exitTaken: string | null = null;
  /** Edges locked for this train's current movement (set when it passes a signal). */
  lock = new Set<EdgeId>();
  /** True once the head has run off the end of the exit edge. */
  atExit = false;
  exitedAt: number | null = null;
  /** Fare coins paid out so far (unloading at a platform, or running through). */
  coinsPaid = 0;
  /** Net money this train has earned so far. */
  earned = 0;
  /** Whole seconds of lateness already charged. */
  lateCharged = 0;
  /** Seconds spent braking for, or standing at, a red signal or unset route. */
  heldSeconds = 0;
  /** Stretch of travel (head distances) over which a through train earns its fare. */
  fareRun: { start: number; length: number } | null = null;
  /** Head distance at which the train started crossing the exit point, if it owes refunds. */
  refundFrom: number | null = null;
  /** Refund coins paid so far while crossing the exit point. */
  refundCoinsPaid = 0;

  constructor(
    plan: ScheduledTrain,
    entry: EdgeGeometry,
    spawnedAt: number,
    physics: TrainPhysics,
    stops: boolean,
  ) {
    this.id = plan.id;
    this.plan = plan;
    this.physics = physics;
    this.spawnedAt = spawnedAt;
    this.stops = stops;
    this.path = [{ edge: entry.id, start: 0, length: entry.length }];
  }

  get length(): number {
    return this.plan.length;
  }

  get tailDist(): number {
    return this.headDist - this.length;
  }

  get headEntry(): PathEntry {
    const entry = this.path[this.path.length - 1];
    if (!entry) throw new Error(`Train ${this.id} has an empty path`);
    return entry;
  }

  /** Offset of the head along its current edge. */
  get headOffset(): number {
    const entry = this.headEntry;
    return this.headDist - entry.start;
  }

  /** Cumulative distance at which the current head edge ends. */
  get headEdgeEnd(): number {
    const entry = this.headEntry;
    return entry.start + entry.length;
  }

  /** Edges that currently carry some part of the train. */
  occupiedEdges(): EdgeId[] {
    const tail = this.tailDist;
    const head = this.headDist;
    return this.path
      .filter((p) => p.start <= head && p.start + p.length >= tail)
      .map((p) => p.edge);
  }

  /** Drop fully-passed path entries and release their route locks. */
  prune(): void {
    const tail = this.tailDist;
    while (this.path.length > 1) {
      const first = this.path[0];
      if (!first || first.start + first.length >= tail) break;
      this.path.shift();
      this.lock.delete(first.edge);
    }
  }
}
