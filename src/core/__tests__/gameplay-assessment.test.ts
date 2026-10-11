/**
 * Gameplay assessment: runs many seeded shifts in fake time with a scripted dispatcher that
 * reacts with a fixed delay, and reports waits, queues, concurrency and deadlocks.
 *
 * Opt-in because it is slow:  ASSESS=1 yarn vitest run gameplay-assessment
 * Writes a JSON report to the path in ASSESS_OUT when set.
 */
import { writeFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { centralStation } from '../layouts/central-station';
import { generateSchedule } from '../schedule';
import { Simulation } from '../simulation';
import type { Train } from '../train';
import type { SwitchId, SwitchState, TrackId } from '../types';

const ENABLED = process.env.ASSESS === '1';
const SHIFTS = Number(process.env.ASSESS_SHIFTS ?? 100);
const REACTION_SECONDS = Number(process.env.ASSESS_REACTION ?? 1);
const DT = 1 / 30;
const DEADLOCK_SECONDS = 20 * 60;

type SwitchPlan = Partial<Record<SwitchId, SwitchState>>;

const FACING: Record<TrackId, SwitchPlan> = {
  P1: { A: 'reverse', B: 'reverse' },
  P2: { A: 'reverse', B: 'normal' },
  T: { A: 'normal', C: 'normal' },
  P3: { A: 'normal', C: 'reverse' },
};
/** Exit route by track group (upper: P1/P2, lower: T/P3) and booked exit. */
const TRAILING: Record<TrackId, Record<string, SwitchPlan>> = {
  P1: {
    N: { D: 'reverse', G: 'normal', K: 'normal' },
    S: { D: 'reverse', G: 'reverse', L: 'reverse' },
  },
  P2: {
    N: { D: 'normal', G: 'normal', K: 'normal' },
    S: { D: 'normal', G: 'reverse', L: 'reverse' },
  },
  T: {
    S: { E: 'normal', J: 'normal', L: 'normal' },
    N: { E: 'normal', J: 'reverse', K: 'reverse' },
  },
  P3: {
    S: { E: 'reverse', J: 'normal', L: 'normal' },
    N: { E: 'reverse', J: 'reverse', K: 'reverse' },
  },
};
const TRACK_EDGE: Record<TrackId, string> = { P1: 'e_p1', P2: 'e_p2', T: 'e_t', P3: 'e_p3' };
const EDGE_TRACK = new Map(Object.entries(TRACK_EDGE).map(([track, edge]) => [edge, track]));
const APPROACH_EDGES = new Set(['e_ap1', 'e_ap2', 'e_ap3', 'e_ap4']);
/** How far a departing train has got towards its exit signal: 3 on the ladder edge in front of it, 2 between the track and the trailing switch, 1 on the track. */
const progress = (t: Train): number => {
  const edge = t.headEntry.edge;
  if (edge === 'e_swd_swg' || edge === 'e_swe_swj') return 3 + t.headOffset / 1000;
  if (EDGE_TRACK.has(edge)) return 1 + t.headOffset / 1000;
  return 2 + t.headOffset / 1000;
};
const LADDER_EDGES = new Set([
  'e_home_swa',
  'e_swa_swb',
  'e_swa_swc',
  'e_swb_p1',
  'e_swb_p2',
  'e_swc_t',
  'e_swc_p3',
]);

type Action =
  | {
      type: 'switch';
      switchId: SwitchId;
      state: SwitchState;
      executeAt: number;
      forTrain: string;
      kind: 'facing' | 'trailing';
    }
  | { type: 'hold'; signalId: string; held: boolean; executeAt: number; forTrain: string };

const TRACK_STARTER: Record<TrackId, string> = { P1: 'S1', P2: 'S2', P3: 'S3', T: 'T2' };

/** A dispatcher that always knows the right route but needs `reaction` seconds per decision. */
class ScriptedDispatcher {
  private queue: Action[] = [];
  private lastPlan = -Infinity;
  /** Time at which the facing route for a train was last completed. */
  readonly routeSetAt = new Map<string, number>();

  constructor(private readonly reaction: number) {}

  queueSnapshot(): Action[] {
    return [...this.queue];
  }

  tick(sim: Simulation): void {
    const now = sim.time;
    // Execute at most one due action per tick: one hand, one switch at a time.
    const due = this.queue.find((a) => a.executeAt <= now);
    if (due) {
      this.queue = this.queue.filter((a) => a !== due);
      if (due.type === 'hold') {
        if (sim.heldByDispatcher.has(due.signalId) !== due.held) sim.toggleSignalHold(due.signalId);
      } else {
        if (sim.switches[due.switchId] !== due.state && !sim.isSwitchLocked(due.switchId)) {
          sim.toggleSwitch(due.switchId);
        }
        if (due.kind === 'facing' && !this.queue.some((a) => a.forTrain === due.forTrain)) {
          this.routeSetAt.set(due.forTrain, now);
        }
      }
    }
    if (now - this.lastPlan < 0.5) return;
    this.lastPlan = now;

    const wants: { plan: SwitchPlan; forTrain: string; kind: 'facing' | 'trailing' }[] = [];
    // Departures: one plan per exit ladder (upper: P1/P2, lower: T/P3), for the train that
    // is furthest along towards its exit signal. Trains queued behind it wait their turn, and
    // the second ladder's plan is skipped if it conflicts with the first on the crossover.
    const UPPER = new Set(['e_p1', 'e_p2', 'e_p1_swd', 'e_p2_swd', 'e_swd_swg']);
    const LOWER = new Set(['e_t', 'e_p3', 'e_t_swe', 'e_p3_swe', 'e_swe_swj']);
    const departing = (group: Set<string>) =>
      sim.trains
        .filter((t) => t.status === 'running' && group.has(t.headEntry.edge))
        .filter((t) => {
          const track = EDGE_TRACK.get(t.headEntry.edge);
          return !(track && t.stops && !t.servedPlatform && track !== 'T');
        })
        .sort((a, b) => progress(b) - progress(a))[0];
    // The track a departing train came from; once it has left the track entirely only the
    // ladder matters, and any track of the same group gives the same crossover plan.
    const trackOf = (t: Train, group: Set<string>): TrackId => {
      for (const entry of t.path) {
        const track = EDGE_TRACK.get(entry.edge);
        if (track) return track;
      }
      return group === UPPER ? 'P2' : 'T';
    };
    const planned: SwitchPlan = {};
    for (const group of [UPPER, LOWER]) {
      const t = departing(group);
      if (!t) continue;
      const track = trackOf(t, group);
      const plan = TRAILING[track]?.[t.plan.exit] ?? {};
      const conflicts = (Object.entries(plan) as [SwitchId, SwitchState][]).some(
        ([id, state]) => planned[id] !== undefined && planned[id] !== state,
      );
      if (conflicts) continue;
      Object.assign(planned, plan);
      wants.push({ plan, forTrain: t.id, kind: 'trailing' });
    }
    // Arrival: the train nearest to the home signal that has not passed it yet.
    const arriving = sim.trains
      .filter(
        (t) =>
          t.status === 'running' &&
          (APPROACH_EDGES.has(t.headEntry.edge) || t.headEntry.edge === 'e_in'),
      )
      .sort((a, b) => b.headDist - a.headDist)[0];
    if (arriving) {
      const target = this.pickTarget(sim, arriving);
      wants.push({ plan: FACING[target] ?? {}, forTrain: arriving.id, kind: 'facing' });
    }

    for (const { plan, forTrain, kind } of wants) {
      let changes = 0;
      for (const [id, state] of Object.entries(plan) as [SwitchId, SwitchState][]) {
        if (sim.switches[id] === state) continue;
        changes += 1;
        if (this.queue.some((a) => a.type === 'switch' && a.switchId === id)) continue;
        this.queue.push({
          type: 'switch',
          switchId: id,
          state,
          executeAt: now + this.reaction,
          forTrain,
          kind,
        });
      }
      if (kind === 'facing' && changes === 0 && !this.routeSetAt.has(forTrain)) {
        this.routeSetAt.set(forTrain, now);
      }
    }

    // Hold the starter of every train on a track until its exit route is fully set, as a
    // careful dispatcher would, so no train runs out of the wrong exit; release it after.
    for (const t of sim.trains) {
      if (t.status === 'left') continue;
      const track = EDGE_TRACK.get(t.headEntry.edge);
      if (!track) continue;
      const starter = TRACK_STARTER[track];
      if (!starter) continue;
      const plan = TRAILING[track]?.[t.plan.exit] ?? {};
      const complete = (Object.entries(plan) as [SwitchId, SwitchState][]).every(
        ([id, state]) => sim.switches[id] === state,
      );
      const wantHeld = !complete;
      if (sim.heldByDispatcher.has(starter) === wantHeld) continue;
      if (this.queue.some((a) => a.type === 'hold' && a.signalId === starter)) continue;
      this.queue.push({
        type: 'hold',
        signalId: starter,
        held: wantHeld,
        executeAt: now + this.reaction,
        forTrain: t.id,
      });
    }
  }

  /**
   * Stopping trains are always routed to their booked platform (waiting at its entry light if
   * it is busy, as a player would). Through trains take the through line when free, else a
   * free platform, else the through line anyway.
   */
  private pickTarget(sim: Simulation, train: Train): TrackId {
    const blocked = sim.blocked;
    const free = (track: TrackId) => !blocked.has(TRACK_EDGE[track] ?? '');
    if (train.stops) return train.plan.destination;
    if (free('T')) return 'T';
    const spare = (['P1', 'P2', 'P3'] as TrackId[]).find(free);
    return spare ?? 'T';
  }
}

interface ShiftReport {
  seed: number;
  finished: boolean;
  duration: number;
  score: number;
  correct: number;
  wrongExits: number;
  trains: number;
  meanDelay: number;
  maxDelay: number;
  /** Seconds trains spent stationary (not dwelling), by location. */
  waits: { approach: number; inbound: number; ladder: number; starter: number };
  trainsThatWaited: number;
  maxInStation: number;
  maxApproachQueue: number;
  timetableWaits: number;
  /** Seconds between the facing route being set and the train reaching the home signal. */
  slack: number[];
  /** Share of simulated time with at least one switch decision outstanding. */
  busyShare: number;
}

function runShift(seed: number): ShiftReport {
  const schedule = generateSchedule({
    seed,
    count: 14,
    platforms: centralStation.platforms.map((p) => p.id),
    throughTracks: centralStation.throughTracks.map((t) => t.id),
    exits: centralStation.exits.map((x) => x.id),
  });
  const sim = new Simulation(centralStation, schedule);
  const bot = new ScriptedDispatcher(REACTION_SECONDS);
  const waits = { approach: 0, inbound: 0, ladder: 0, starter: 0 };
  const waited = new Set<string>();
  const passedHome = new Map<string, number>();
  let maxInStation = 0;
  let maxApproachQueue = 0;
  let timetableWaits = 0;
  let busyTicks = 0;
  let ticks = 0;
  let overdue = new Set<string>();

  while (!sim.finished && sim.time < DEADLOCK_SECONDS) {
    bot.tick(sim);
    sim.step(DT);
    ticks += 1;
    let inStation = 0;
    let approachQueue = 0;
    let anyWaiting = false;
    for (const t of sim.trains) {
      if (t.status === 'left') continue;
      const edge = t.headEntry.edge;
      if (APPROACH_EDGES.has(edge)) approachQueue += 1;
      else inStation += 1;
      if (!passedHome.has(t.id) && !APPROACH_EDGES.has(edge) && edge !== 'e_in') {
        passedHome.set(t.id, sim.time);
      }
      if (t.status === 'running' && t.speed === 0 && !t.atExit) {
        anyWaiting = true;
        waited.add(t.id);
        if (APPROACH_EDGES.has(edge)) waits.approach += DT;
        else if (edge === 'e_in') waits.inbound += DT;
        else if (LADDER_EDGES.has(edge)) waits.ladder += DT;
        else waits.starter += DT;
      }
    }
    if (anyWaiting) busyTicks += 1;
    maxInStation = Math.max(maxInStation, inStation);
    maxApproachQueue = Math.max(maxApproachQueue, approachQueue);
    const nowOverdue = new Set(sim.pending.filter((p) => p.at + 1 < sim.time).map((p) => p.id));
    for (const id of nowOverdue) if (!overdue.has(id)) timetableWaits += 1;
    overdue = nowOverdue;
  }

  if (!sim.finished && process.env.ASSESS_DUMP === String(seed)) {
    const dump = {
      time: sim.time,
      switches: sim.switches,
      aspects: Object.fromEntries(sim.aspects),
      locked: [...sim.locked],
      occupied: [...sim.occupied],
      pending: sim.pending.map((p) => p.id),
      botQueue: bot.queueSnapshot(),
      trains: sim.trains
        .filter((t) => t.status !== 'left')
        .map((t) => ({
          id: t.id,
          dest: t.plan.destination,
          stops: t.stops,
          status: t.status,
          edge: t.headEntry.edge,
          offset: Math.round(t.headOffset),
          speed: Math.round(t.speed),
          served: t.servedPlatform,
          lock: [...t.lock],
        })),
      lastEvents: sim.events.slice(-12),
    };
    console.log(JSON.stringify(dump, null, 1));
  }

  const slack: number[] = [];
  for (const [id, at] of passedHome) {
    const set = bot.routeSetAt.get(id);
    if (set !== undefined) slack.push(at - set);
  }
  const delays = sim.results.map((r) => r.delaySeconds);
  return {
    seed,
    finished: sim.finished,
    duration: sim.time,
    score: sim.money,
    correct: sim.results.filter((r) => r.correct).length,
    wrongExits: sim.results.filter((r) => !r.correctExit).length,
    trains: sim.results.length,
    meanDelay: delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 0,
    maxDelay: delays.length ? Math.max(...delays) : 0,
    waits,
    trainsThatWaited: waited.size,
    maxInStation,
    maxApproachQueue,
    timetableWaits,
    slack,
    busyShare: ticks ? busyTicks / ticks : 0,
  };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
};

describe.skipIf(!ENABLED)('gameplay assessment', () => {
  it(`runs ${SHIFTS} shifts with a ${REACTION_SECONDS}s-reaction dispatcher`, () => {
    const reports: ShiftReport[] = [];
    for (let seed = 1; seed <= SHIFTS; seed += 1) reports.push(runShift(seed));

    const slack = reports.flatMap((r) => r.slack);
    const summary = {
      shifts: reports.length,
      reaction: REACTION_SECONDS,
      deadlocks: reports.filter((r) => !r.finished).map((r) => r.seed),
      duration: {
        mean: mean(reports.map((r) => r.duration)),
        max: Math.max(...reports.map((r) => r.duration)),
      },
      score: {
        mean: mean(reports.map((r) => r.score)),
        min: Math.min(...reports.map((r) => r.score)),
        max: Math.max(...reports.map((r) => r.score)),
      },
      wrongRoutes: reports.reduce((a, r) => a + (r.trains - r.correct), 0),
      wrongExits: reports.reduce((a, r) => a + r.wrongExits, 0),
      delay: {
        mean: mean(reports.map((r) => r.meanDelay)),
        p90: pct(
          reports.map((r) => r.maxDelay),
          90,
        ),
        max: Math.max(...reports.map((r) => r.maxDelay)),
      },
      waitsPerShift: {
        approach: mean(reports.map((r) => r.waits.approach)),
        inbound: mean(reports.map((r) => r.waits.inbound)),
        ladder: mean(reports.map((r) => r.waits.ladder)),
        starter: mean(reports.map((r) => r.waits.starter)),
      },
      trainsThatWaited: { mean: mean(reports.map((r) => r.trainsThatWaited)), of: 14 },
      maxInStation: {
        mean: mean(reports.map((r) => r.maxInStation)),
        max: Math.max(...reports.map((r) => r.maxInStation)),
      },
      maxApproachQueue: {
        mean: mean(reports.map((r) => r.maxApproachQueue)),
        max: Math.max(...reports.map((r) => r.maxApproachQueue)),
      },
      timetableWaits: { total: reports.reduce((a, r) => a + r.timetableWaits, 0) },
      slack: {
        mean: mean(slack),
        p10: pct(slack, 10),
        p50: pct(slack, 50),
        p90: pct(slack, 90),
        negative: slack.filter((s) => s < 0).length,
        under2s: slack.filter((s) => s < 2).length,
        total: slack.length,
      },
      busyShare: mean(reports.map((r) => r.busyShare)),
    };
    console.log(JSON.stringify(summary, null, 2));
    if (process.env.ASSESS_OUT) {
      writeFileSync(process.env.ASSESS_OUT, JSON.stringify({ summary, reports }, null, 2));
    }
    expect(reports.length).toBe(SHIFTS);
  }, 600_000);
});
