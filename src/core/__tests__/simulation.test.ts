import { describe, expect, it } from 'vitest';

import { centralStation } from '../layouts/central-station';
import { Simulation } from '../simulation';
import { DEFAULT_PHYSICS, PLATFORM_PASS_SPEED_FACTOR } from '../train';
import type { ScheduledTrain } from '../types';

const DT = 1 / 60;

const run = (sim: Simulation, seconds: number, until?: () => boolean): void => {
  const steps = Math.ceil(seconds / DT);
  for (let i = 0; i < steps; i += 1) {
    if (until?.()) return;
    sim.step(DT);
  }
};

const train = (overrides: Partial<ScheduledTrain> = {}): ScheduledTrain => ({
  id: 'RE 1',
  at: 0,
  destination: 'P3',
  exit: 'S',
  length: 100,
  dwell: 2,
  ...overrides,
});

const throughTrain = (overrides: Partial<ScheduledTrain> = {}): ScheduledTrain =>
  train({ id: 'IC 9', destination: 'T', dwell: 0, ...overrides });

/** Route to P3: C and E reverse. */
const setRouteP3 = (sim: Simulation): void => {
  for (const id of ['C', 'E']) expect(sim.toggleSwitch(id)).toBe(true);
};

describe('Simulation', () => {
  it('runs a stopping train to platform 3 once the route is set and scores it', () => {
    const sim = new Simulation(centralStation, [train()]);
    setRouteP3(sim);
    run(sim, 60, () => sim.finished);

    expect(sim.finished).toBe(true);
    const result = sim.results[0];
    expect(result?.servedPlatform).toBe('P3');
    expect(result?.correct).toBe(true);
    expect(result?.delaySeconds).toBe(0);
    expect(result?.earned).toBe(100);
    expect(sim.money).toBe(100);
    expect(sim.events.filter((e) => e.kind !== 'money').map((e) => e.kind)).toEqual([
      'switch',
      'switch',
      'arrival',
      'stopped',
      'departed',
      'left',
    ]);
  });

  describe('money', () => {
    const coins = (sim: Simulation, reason: string): number[] =>
      sim.events.flatMap((e) => (e.kind === 'money' && e.reason === reason ? [e.amount] : []));

    it('pays the fare coin by coin while the train unloads at its booked platform', () => {
      const sim = new Simulation(centralStation, [train({ dwell: 10 })]);
      setRouteP3(sim);
      run(sim, 60, () => sim.trains[0]?.status === 'dwelling');
      run(sim, 5);
      expect(coins(sim, 'unload')).toHaveLength(5);
      run(sim, 60, () => sim.finished);
      expect(coins(sim, 'unload')).toEqual(Array<number>(10).fill(10));
      expect(sim.money).toBe(100);
    });

    it('pays half as many coins at the wrong platform', () => {
      const sim = new Simulation(centralStation, [train({ destination: 'P1' })]);
      setRouteP3(sim);
      run(sim, 60, () => sim.finished);
      expect(coins(sim, 'unload')).toEqual(Array<number>(5).fill(10));
    });

    it('pays a through train as it runs along the through line', () => {
      const sim = new Simulation(centralStation, [throughTrain()]);
      run(sim, 60, () => sim.finished);
      expect(coins(sim, 'through')).toEqual(Array<number>(10).fill(10));
    });

    it('refunds the fare at the exit point as a train crosses it by the wrong exit', () => {
      const sim = new Simulation(centralStation, [train({ destination: 'P1' })]);
      for (const id of ['A', 'B', 'D']) sim.toggleSwitch(id);
      run(sim, 60, () => sim.finished);
      expect(coins(sim, 'wrong-exit')).toEqual(Array<number>(10).fill(-10));
      expect(sim.events.find((e) => e.kind === 'money' && e.reason === 'wrong-exit')).toMatchObject(
        { exit: 'N' },
      );
      expect(sim.money).toBe(0);
      // One coin per tenth of the train's length as it crosses the exit point.
      const times = sim.events.flatMap((e) =>
        e.kind === 'money' && e.reason === 'wrong-exit' ? [e.time] : [],
      );
      const exitedAt = sim.trains[0]?.exitedAt ?? 0;
      expect(times[9]).toBeCloseTo(exitedAt, 1);
      expect(exitedAt - (times[0] ?? 0)).toBeGreaterThan(0.5);
      expect(new Set(times).size).toBe(10);
    });

    it('refunds a missed stop at the exit point as the train leaves, not on the through line', () => {
      const sim = new Simulation(centralStation, [train()]);
      run(sim, 60, () => sim.trains[0]?.headEntry.edge === 'e_out_s');
      expect(coins(sim, 'missed-stop')).toHaveLength(0);
      run(sim, 60, () => sim.finished);
      const refunds = sim.events.filter((e) => e.kind === 'money' && e.reason === 'missed-stop');
      expect(refunds).toHaveLength(10);
      expect(refunds[0]).toMatchObject({ amount: -10, exit: 'S' });
      expect(refunds.at(-1)?.time).toBeCloseTo(sim.trains[0]?.exitedAt ?? 0, 1);
    });

    it('stacks the missed-stop and wrong-exit refunds', () => {
      const sim = new Simulation(centralStation, [train({ exit: 'N' })]);
      run(sim, 60, () => sim.finished);
      expect(coins(sim, 'missed-stop')).toHaveLength(10);
      expect(coins(sim, 'wrong-exit')).toHaveLength(10);
      expect(sim.money).toBe(-200);
      // Missed-stop coins come first, then wrong-exit coins, all while crossing the exit point.
      const reasons = sim.events.flatMap((e) => (e.kind === 'money' ? [e.reason] : []));
      expect(reasons.indexOf('wrong-exit')).toBe(10);
    });

    it('charges every second a train on the layout runs late beyond the grace', () => {
      const sim = new Simulation(centralStation, [train()], { nominalTripSeconds: 0 });
      // Deadline is 2 s (dwell) + 8 s grace; the train is still on its way at 15 s.
      run(sim, 15);
      expect(coins(sim, 'late')).toEqual(Array<number>(5).fill(-2));
    });
  });

  it('stops at the end of the platform bar, short of the outgoing light', () => {
    const sim = new Simulation(centralStation, [train()]);
    setRouteP3(sim);
    run(sim, 60, () => sim.trains[0]?.status === 'dwelling');
    const t = sim.trains[0];
    expect(t?.headEntry.edge).toBe('e_p3');
    // Platform edge is 400 long; the bar ends 20 units before the starter at x=800.
    expect(t?.headOffset).toBeCloseTo(380, 3);
    expect(sim.graph.pointAlong(sim.graph.edge('e_p3'), t?.headOffset ?? 0).x).toBeCloseTo(780, 3);
  });

  it('penalises a stopping train sent down the through line without stopping', () => {
    const sim = new Simulation(centralStation, [train()]);
    run(sim, 60, () => sim.finished);
    const result = sim.results[0];
    expect(result?.servedPlatform).toBeNull();
    expect(result?.viaThrough).toBe(true);
    expect(result?.correct).toBe(false);
    expect(result?.earned).toBe(-100);
    expect(sim.money).toBe(-100);
    expect(
      sim.events.flatMap((e) => (e.kind === 'money' ? [`${e.reason} ${e.amount}`] : [])),
    ).toEqual(Array<string>(10).fill('missed-stop -10'));
    expect(sim.events.filter((e) => e.kind !== 'money').map((e) => e.kind)).toEqual([
      'arrival',
      'passing',
      'left',
    ]);
    expect(sim.events[1]).toMatchObject({ kind: 'passing', track: 'T', correct: false });
  });

  it('penalises a stopping train sent to the wrong platform', () => {
    const sim = new Simulation(centralStation, [train({ destination: 'P1' })]);
    setRouteP3(sim);
    run(sim, 60, () => sim.finished);
    expect(sim.results[0]?.servedPlatform).toBe('P3');
    expect(sim.results[0]?.correct).toBe(false);
    expect(sim.results[0]?.earned).toBe(50);
  });

  it('reaches platform 1 when the dispatcher sets the ladder before arrival', () => {
    const sim = new Simulation(centralStation, [train({ destination: 'P1' })]);
    for (const id of ['A', 'B', 'D']) expect(sim.toggleSwitch(id)).toBe(true);
    run(sim, 60, () => sim.finished);
    expect(sim.results[0]?.servedPlatform).toBe('P1');
    expect(sim.results[0]?.exitTaken).toBe('N');
    expect(sim.results[0]?.correctExit).toBe(false);
    expect(sim.results[0]?.earned).toBe(0);
  });

  it('scores the booked exit and routes across the diamond to reach it', () => {
    const sim = new Simulation(centralStation, [train({ destination: 'P1', exit: 'S' })]);
    for (const id of ['A', 'B', 'D', 'G', 'L']) expect(sim.toggleSwitch(id)).toBe(true);
    run(sim, 60, () => sim.finished);
    expect(sim.results[0]?.servedPlatform).toBe('P1');
    expect(sim.results[0]?.exitTaken).toBe('S');
    expect(sim.results[0]?.correctExit).toBe(true);
    expect(sim.results[0]?.earned).toBe(100);
  });

  it('runs a through train down the centre line without stopping', () => {
    const sim = new Simulation(centralStation, [throughTrain()]);
    run(sim, 60, () => sim.finished);
    const result = sim.results[0];
    expect(result?.viaThrough).toBe(true);
    expect(result?.servedPlatform).toBeNull();
    expect(result?.correct).toBe(true);
    expect(result?.earned).toBe(100);
    expect(sim.events.filter((e) => e.kind !== 'money').map((e) => e.kind)).toEqual([
      'arrival',
      'passing',
      'left',
    ]);
    expect(sim.events[1]).toMatchObject({ kind: 'passing', track: 'T', correct: true });
    expect(sim.trains[0]?.exitedAt).toBeLessThan(26);
  });

  it('lets a through train run through a platform without stopping, at reduced speed', () => {
    const sim = new Simulation(centralStation, [throughTrain()]);
    setRouteP3(sim);
    let maxSpeedOnPlatform = 0;
    run(sim, 60, () => {
      const t = sim.trains[0];
      if (t && t.status !== 'left' && t.headEntry.edge === 'e_p3') {
        maxSpeedOnPlatform = Math.max(maxSpeedOnPlatform, t.speed);
      }
      return sim.finished;
    });
    const result = sim.results[0];
    expect(result?.servedPlatform).toBeNull();
    expect(result?.viaThrough).toBe(false);
    expect(result?.correct).toBe(true);
    expect(result?.earned).toBe(100);
    expect(sim.events.filter((e) => e.kind === 'money' && e.reason === 'through')).toHaveLength(10);
    expect(sim.events.some((e) => e.kind === 'stopped')).toBe(false);
    expect(sim.events).toContainEqual(
      expect.objectContaining({ kind: 'passing', track: 'P3', correct: true }),
    );
    expect(maxSpeedOnPlatform).toBeGreaterThan(0);
    // Braking for the restriction starts before the platform; one tick of overshoot is allowed.
    expect(maxSpeedOnPlatform).toBeLessThanOrEqual(
      DEFAULT_PHYSICS.maxSpeed * PLATFORM_PASS_SPEED_FACTOR + 2,
    );
  });

  it('holds a train at the platform entry light while the platform is occupied', () => {
    const sim = new Simulation(centralStation, [
      train({ id: 'A', dwell: 20 }),
      train({ id: 'B', at: 1 }),
    ]);
    setRouteP3(sim);
    // Let A reach platform 3 and start dwelling.
    run(sim, 60, () => sim.trains[0]?.status === 'dwelling');
    expect(sim.trains[0]?.status).toBe('dwelling');
    // The starter already shows the clear exit route while A is still loading.
    expect(sim.aspects.get('S3')).toBe('green');
    expect(sim.aspects.get('E3')).toBe('red');

    // B passes the yellow home signal and stops in front of E3 on the ladder.
    const b = sim.trains[1];
    run(sim, 20, () => b?.speed === 0 && b.headEntry.edge === 'e_swc_p3');
    expect(b?.status).toBe('running');
    expect(b?.speed).toBe(0);
    expect(b?.headEntry.edge).toBe('e_swc_p3');
    // B is committed to platform 3: the ladder switches are locked by its route.
    expect(sim.isSwitchLocked('C')).toBe(true);
    expect(sim.toggleSwitch('C')).toBe(false);
    // The home signal is red because the ladder is occupied by B.
    expect(sim.aspects.get('H')).toBe('red');

    // Once A departs and clears platform 3, E3 clears and B moves on.
    run(sim, 60, () => (b?.speed ?? 0) > 0);
    expect(sim.trains[0]?.status).toBe('running');
    expect(sim.trains[0]?.occupiedEdges()).not.toContain('e_p3');
    expect(b?.speed).toBeGreaterThan(0);
    run(sim, 60, () => sim.finished);
    expect(sim.results.map((r) => r.servedPlatform)).toEqual(['P3', 'P3']);
  });

  it('keeps a loading train at the platform even when its starter is green', () => {
    const sim = new Simulation(centralStation, [train({ dwell: 5 })]);
    setRouteP3(sim);
    run(sim, 60, () => sim.trains[0]?.status === 'dwelling');
    const t = sim.trains[0];
    expect(sim.aspects.get('S3')).toBe('green');
    run(sim, 3);
    expect(t?.status).toBe('dwelling');
    expect(t?.speed).toBe(0);
    run(sim, 3);
    expect(t?.status).toBe('running');
    expect(t?.speed).toBeGreaterThan(0);
  });

  it('shows yellow at the home signal when the booked platform is occupied', () => {
    const sim = new Simulation(centralStation, [train({ id: 'A', dwell: 20 })]);
    setRouteP3(sim);
    run(sim, 60, () => sim.trains[0]?.status === 'dwelling');
    expect(sim.aspects.get('H')).toBe('yellow');
    expect(sim.aspects.get('E3')).toBe('red');
  });

  it('locks switches under a passing train and releases them afterwards', () => {
    const sim = new Simulation(centralStation, [train()]);
    setRouteP3(sim);
    run(sim, 30, () => sim.trains[0]?.headEntry.edge === 'e_swa_swc');
    expect(sim.trains[0]?.headEntry.edge).toBe('e_swa_swc');
    expect(sim.isSwitchLocked('A')).toBe(true);
    expect(sim.isSwitchLocked('C')).toBe(true);
    expect(sim.toggleSwitch('A')).toBe(false);
    expect(sim.events.at(-1)).toMatchObject({ kind: 'switch-locked', switchId: 'A' });
    // Switches off the route stay free.
    expect(sim.isSwitchLocked('B')).toBe(false);

    run(sim, 30, () => sim.trains[0]?.status === 'dwelling');
    expect(sim.isSwitchLocked('A')).toBe(false);
    expect(sim.isSwitchLocked('C')).toBe(false);
    // The exit route is not locked until the train passes its starter.
    expect(sim.isSwitchLocked('E')).toBe(false);
  });

  it('never lets a train pass a red signal', () => {
    const sim = new Simulation(centralStation, [train()]);
    sim.toggleSwitch('C'); // into P3, but E stays normal: starter S3 is red
    run(sim, 40, () => sim.trains[0]?.status === 'dwelling');
    run(sim, 10);
    const t = sim.trains[0];
    expect(t?.status).toBe('running');
    expect(t?.headEntry.edge).toBe('e_p3');
    expect(t?.speed).toBe(0);
    expect(sim.aspects.get('S3')).toBe('red');
  });

  it('delays the next arrival while the approach track is occupied', () => {
    const sim = new Simulation(centralStation, [train({ id: 'A' }), train({ id: 'B', at: 0.5 })]);
    run(sim, 0.6);
    expect(sim.trains.map((t) => t.id)).toEqual(['A']);
    run(sim, 10, () => sim.trains.length === 2);
    expect(sim.trains.map((t) => t.id)).toEqual(['A', 'B']);
    expect(sim.trains[1]?.spawnedAt).toBeGreaterThan(1);
  });

  it('queues a train at the entrance signal while another waits at the home signal', () => {
    // Nobody sets the exit route, so S3 stays red: A parks at P3, B waits at E3 in the
    // ladder, C waits at H on the inbound track and D is held off stage at IN.
    const sim = new Simulation(centralStation, [
      train({ id: 'A', dwell: 60 }),
      train({ id: 'B', at: 1 }),
      train({ id: 'C', at: 2 }),
      train({ id: 'D', at: 3 }),
    ]);
    sim.toggleSwitch('C');
    run(sim, 90, () => sim.trains.length === 4 && sim.trains[3]?.speed === 0);
    const [a, b, c, d] = sim.trains;
    expect(a?.status).toBe('dwelling');
    expect(b?.headEntry.edge).toBe('e_swc_p3');
    expect(c?.headEntry.edge).toBe('e_in');
    expect(c?.speed).toBe(0);
    expect(d?.headEntry.edge).toBe('e_ap4');
    expect(d?.speed).toBe(0);
    expect(sim.aspects.get('IN')).toBe('red');
    expect(sim.aspects.get('H')).toBe('red');
  });

  it('queues trains one per approach section when the station is blocked', () => {
    const sim = new Simulation(
      centralStation,
      ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((id, i) => train({ id, at: i, dwell: 120 })),
    );
    sim.toggleSwitch('C');
    run(sim, 120, () => sim.trains.length === 7 && sim.trains.every((t) => t.speed === 0));
    const edges = sim.trains.map((t) => t.headEntry.edge);
    expect(edges).toEqual(['e_p3', 'e_swc_p3', 'e_in', 'e_ap4', 'e_ap3', 'e_ap2', 'e_ap1']);
    expect(sim.aspects.get('AP1')).toBe('red');
    expect(sim.aspects.get('AP3')).toBe('red');
    // Every queued train fits inside its own section.
    for (const t of sim.trains) expect(t.occupiedEdges()).toHaveLength(1);
  });

  it('lets the dispatcher hold a signal at red and release it', () => {
    const sim = new Simulation(centralStation, [train()]);
    setRouteP3(sim);
    expect(sim.toggleSignalHold('S3')).toBe(true);
    expect(sim.aspects.get('S3')).toBe('red');
    expect(sim.aspects.get('E3')).toBe('yellow');
    expect(sim.events.at(-1)).toMatchObject({ kind: 'signal-hold', signalId: 'S3', held: true });
    run(sim, 60, () => sim.trains[0]?.status === 'dwelling');
    run(sim, 10);
    const t = sim.trains[0];
    expect(t?.status).toBe('running');
    expect(t?.speed).toBe(0);
    expect(t?.headEntry.edge).toBe('e_p3');
    expect(sim.toggleSignalHold('S3')).toBe(false);
    expect(sim.aspects.get('S3')).toBe('green');
    run(sim, 60, () => sim.finished);
    expect(sim.results[0]?.earned).toBe(100);
    expect(() => sim.toggleSignalHold('Z9')).toThrow();
  });

  it('holds an arriving train at a manually held home signal', () => {
    const sim = new Simulation(centralStation, [train()]);
    sim.toggleSignalHold('H');
    run(sim, 40, () => sim.trains[0]?.speed === 0 && sim.trains[0].headEntry.edge === 'e_in');
    expect(sim.trains[0]?.headEntry.edge).toBe('e_in');
    expect(sim.aspects.get('H')).toBe('red');
    expect(sim.aspects.get('IN')).toBe('red');
  });

  it('rejects a schedule with an unknown destination or exit', () => {
    expect(() => new Simulation(centralStation, [train({ destination: 'P4' })])).toThrow();
    expect(() => new Simulation(centralStation, [train({ exit: 'W' })])).toThrow();
  });

  it('holds the second train at the diamond until the first has crossed', () => {
    // A: P2 -> S over the upper diagonal. B: T -> N over the lower diagonal. Both need X.
    const sim = new Simulation(centralStation, [
      train({ id: 'A', destination: 'P2', exit: 'S', dwell: 1 }),
      train({ id: 'B', destination: 'T', exit: 'N', at: 6, dwell: 0 }),
    ]);
    // Facing route for A; crossover diagonals selected but both exits still set against them.
    for (const id of ['A', 'G', 'J']) expect(sim.toggleSwitch(id)).toBe(true);
    const a = () => sim.trains[0];
    const b = () => sim.trains[1];
    // Once A has cleared the ladder, point the ladder at the through line for B.
    run(sim, 60, () => a()?.headEntry.edge === 'e_p2' && !sim.isSwitchLocked('A'));
    expect(sim.toggleSwitch('A')).toBe(true);
    // Both trains come to a stand at their exit signals in front of the diamond.
    run(sim, 90, () => {
      const first = a();
      const second = b();
      return (
        first?.headEntry.edge === 'e_swd_swg' &&
        first.speed === 0 &&
        second?.headEntry.edge === 'e_swe_swj' &&
        second.speed === 0
      );
    });
    expect(a()?.headEntry.edge).toBe('e_swd_swg');
    expect(b()?.headEntry.edge).toBe('e_swe_swj');
    expect(sim.aspects.get('O1')).toBe('red');
    expect(sim.aspects.get('O2')).toBe('red');

    // Open both exits in the same instant: only one train may take the diamond at a time.
    for (const id of ['L', 'K']) expect(sim.toggleSwitch(id)).toBe(true);
    const crossingEdges = new Set(['e_swg_x', 'e_x_swl', 'e_swj_x', 'e_x_swk']);
    let bothOnDiamond = false;
    let secondWaited = false;
    run(sim, 120, () => {
      const onDiamond = sim.trains.filter(
        (t) => t.status !== 'left' && t.occupiedEdges().some((e) => crossingEdges.has(e)),
      );
      if (onDiamond.length > 1) bothOnDiamond = true;
      if (
        onDiamond.length === 1 &&
        sim.trains.some((t) => t.speed === 0 && t.status === 'running')
      ) {
        secondWaited = true;
      }
      return sim.finished;
    });
    expect(sim.finished).toBe(true);
    expect(bothOnDiamond).toBe(false);
    expect(secondWaited).toBe(true);
    expect(sim.results.map((r) => [r.id, r.exitTaken, r.correctExit])).toEqual([
      ['A', 'S', true],
      ['B', 'N', true],
    ]);
  });
});
