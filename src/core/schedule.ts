import type { ExitId, ScheduledTrain, TrackId } from './types';

/** Small deterministic PRNG (mulberry32) so a shift can be replayed from its seed. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ScheduleOptions {
  seed: number;
  count: number;
  /** Platforms a stopping train can be booked for. */
  platforms: TrackId[];
  /** Through tracks a non-stopping train can be booked for (empty = no through trains). */
  throughTracks?: TrackId[];
  /** Share of trains that run through without stopping, 0..1. */
  throughShare?: number;
  /** Exits trains can be booked for; each train gets one at random. */
  exits: ExitId[];
  /** Seconds before the first train arrives. */
  firstAt?: number;
  /** Inclusive range of seconds between consecutive arrivals. */
  gap?: [number, number];
  /** Probability that the next train follows closely (a bunch), 0..1. */
  bunchChance?: number;
  /** Inclusive range of seconds between bunched arrivals. */
  bunchGap?: [number, number];
  length?: [number, number];
  /** Seconds of dwell every stopping train needs regardless of length. */
  dwellBase?: number;
  /** Extra dwell seconds per unit of train length (longer trains unload longer). */
  dwellPerUnit?: number;
  /**
   * Minimum seconds between two trains booked for the same platform, so the second never
   * arrives while the first is still occupying it. Arrivals are pushed later if no platform
   * is clear.
   */
  platformGap?: number;
}

const STOPPING_SERVICES = ['RE', 'S', 'RB'];
const THROUGH_SERVICES = ['IC', 'EC', 'ICE'];

/** Generate a deterministic timetable for one dispatcher shift. */
export function generateSchedule(options: ScheduleOptions): ScheduledTrain[] {
  const rng = createRng(options.seed);
  const gap = options.gap ?? [13, 21];
  const bunchChance = options.bunchChance ?? 0.35;
  const bunchGap = options.bunchGap ?? [9, 12];
  const length = options.length ?? [90, 140];
  const dwellBase = options.dwellBase ?? 4;
  const dwellPerUnit = options.dwellPerUnit ?? 0.06;
  const platformGap = options.platformGap ?? 30;
  const throughTracks = options.throughTracks ?? [];
  const throughShare = throughTracks.length > 0 ? (options.throughShare ?? 0.3) : 0;
  const pick = <T>(items: readonly T[]): T => {
    const item = items[Math.floor(rng() * items.length)];
    if (item === undefined) throw new Error('Cannot pick from an empty list');
    return item;
  };
  const between = (range: [number, number]): number =>
    range[0] + Math.floor(rng() * (range[1] - range[0] + 1));

  const trains: ScheduledTrain[] = [];
  const lastBookedAt = new Map<TrackId, number>();
  let at = options.firstAt ?? 4;
  for (let i = 0; i < options.count; i += 1) {
    const through = rng() < throughShare;
    let destination: TrackId;
    if (through) {
      destination = pick(throughTracks);
    } else {
      // Only platforms whose previous train has had time to clear; otherwise wait for one.
      const clearAt = (p: TrackId) => (lastBookedAt.get(p) ?? -Infinity) + platformGap;
      let clear = options.platforms.filter((p) => clearAt(p) <= at);
      if (clear.length === 0) {
        at = Math.min(...options.platforms.map(clearAt));
        clear = options.platforms.filter((p) => clearAt(p) <= at);
      }
      destination = pick(clear);
      lastBookedAt.set(destination, at);
    }
    const trainLength = between(length);
    trains.push({
      id: `${pick(through ? THROUGH_SERVICES : STOPPING_SERVICES)} ${100 + Math.floor(rng() * 900)}`,
      at,
      destination,
      exit: pick(options.exits),
      length: trainLength,
      dwell: through ? 0 : Math.round(dwellBase + dwellPerUnit * trainLength),
    });
    // Bunched arrivals put several trains in the station at the same time.
    at += between(rng() < bunchChance ? bunchGap : gap);
  }
  return trains;
}
