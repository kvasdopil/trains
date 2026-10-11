export type NodeId = string;
export type EdgeId = string;
export type SwitchId = string;
export type SignalId = string;
export type PlatformId = string;
export type TrainId = string;

export interface Point {
  x: number;
  y: number;
}

export interface TrackNode {
  id: NodeId;
  pos: Point;
}

/**
 * A track segment. Edges are oriented in the direction of travel (`from` -> `to`).
 * Feature 1 is single-direction (west to east), so trains always traverse edges forward.
 */
export interface TrackEdge {
  id: EdgeId;
  from: NodeId;
  to: NodeId;
}

export type SwitchState = 'normal' | 'reverse';

/**
 * A switch joins a `toe` edge with two leg edges. A train arriving on the toe is sent to
 * the leg selected by `state`. A train arriving on a leg may only pass if the switch is set
 * for that leg (otherwise the route is "not set").
 */
export interface Switch {
  id: SwitchId;
  node: NodeId;
  toe: EdgeId;
  normal: EdgeId;
  reverse: EdgeId;
  /** Pixel offset for the on-screen label. */
  labelOffset?: Point;
}

export type Aspect = 'red' | 'yellow' | 'green';

/**
 * A signal stands at `node` and is seen by trains travelling along `fromEdge` towards it.
 * It protects the section that starts at `node` and ends at the next signal (or the exit).
 */
export interface Signal {
  id: SignalId;
  node: NodeId;
  fromEdge: EdgeId;
  /** Which side of the track the signal head is drawn on. */
  side?: 'above' | 'below';
}

/** Default distance between a platform edge's ends and the platform bar itself. */
export const DEFAULT_PLATFORM_MARGIN = 20;

/**
 * A passenger platform. The platform bar is inset `margin` units from both ends of `edge`;
 * a train stops with its head at the far end of the bar, short of the outgoing light.
 */
export interface Platform {
  id: PlatformId;
  name: string;
  edge: EdgeId;
  margin?: number;
}

/** A track where trains run through without stopping. */
export interface ThroughTrack {
  id: TrackId;
  name: string;
  edge: EdgeId;
}

/** A destination a train can be booked for: a platform id or a through-track id. */
export type TrackId = string;
export type ExitId = string;

/**
 * A diamond crossing: two tracks cross at `node` without any switch. A train arriving on
 * the `from` edge of a pair continues onto that pair's `to` edge. Routes over either pair
 * conflict with each other.
 */
export interface Crossing {
  id: string;
  node: NodeId;
  pairs: [{ from: EdgeId; to: EdgeId }, { from: EdgeId; to: EdgeId }];
}

/** A track leaving the station. Trains are booked for an exit as well as a platform. */
export interface Exit {
  id: ExitId;
  name: string;
  edge: EdgeId;
}

export interface StationLayout {
  name: string;
  nodes: TrackNode[];
  edges: TrackEdge[];
  switches: Switch[];
  signals: Signal[];
  platforms: Platform[];
  throughTracks: ThroughTrack[];
  crossings: Crossing[];
  /** Edge on which new trains appear. */
  entry: EdgeId;
  /** Tracks from which trains leave the station. */
  exits: Exit[];
}

export interface ScheduledTrain {
  id: TrainId;
  /** Shift time (seconds) at which the train should arrive on the entry track. */
  at: number;
  /** Booked destination: a platform (the train stops there) or a through track (it must not stop). */
  destination: TrackId;
  /** Booked exit the train must leave by. */
  exit: ExitId;
  /** Train length in track units (pixels). */
  length: number;
  /** Seconds the train must dwell at the platform before departing (0 for through trains). */
  dwell: number;
}
