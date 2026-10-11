import { describe, expect, it } from 'vitest';

import { TrackGraph } from '../graph';
import { centralStation } from '../layouts/central-station';
import { computeAspects, routeAhead } from '../signals';
import type { EdgeId, SignalId } from '../types';

const graph = new TrackGraph(centralStation);
const signal = (id: SignalId) => {
  const found = centralStation.signals.find((s) => s.id === id);
  if (!found) throw new Error(`fixture signal ${id} missing`);
  return found;
};

const aspectsWith = (
  overrides: Record<string, 'normal' | 'reverse'> = {},
  blocked: EdgeId[] = [],
  held: SignalId[] = [],
) =>
  computeAspects(graph, {
    states: { ...graph.defaultSwitchStates(), ...overrides },
    blocked: new Set(blocked),
    held: new Set(held),
  });

describe('routeAhead', () => {
  it('walks from the home signal through the ladder to the through-line entry light', () => {
    const route = routeAhead(graph, signal('H'), graph.defaultSwitchStates());
    expect(route.status).toBe('ok');
    expect(route.edges).toEqual(['e_home_swa', 'e_swa_swc', 'e_swc_t']);
    expect(route.nextSignal?.id).toBe('T1');
  });

  it('walks from a platform entry signal to its starter', () => {
    const route = routeAhead(graph, signal('E3'), graph.defaultSwitchStates());
    expect(route.edges).toEqual(['e_p3']);
    expect(route.nextSignal?.id).toBe('S3');
  });

  it('walks from the through-line exit light to the south exit signal', () => {
    const route = routeAhead(graph, signal('T2'), graph.defaultSwitchStates());
    expect(route.status).toBe('ok');
    expect(route.edges).toEqual(['e_t_swe', 'e_swe_swj']);
    expect(route.nextSignal?.id).toBe('O2');
  });

  it('walks from the entrance signal to the home signal and from the exit signals off stage', () => {
    const entrance = routeAhead(graph, signal('IN'), graph.defaultSwitchStates());
    expect(entrance.edges).toEqual(['e_in']);
    expect(entrance.nextSignal?.id).toBe('H');
    const south = routeAhead(graph, signal('O2'), graph.defaultSwitchStates());
    expect(south.edges).toEqual(['e_swj_swl', 'e_out_s']);
    expect(south.conflicts).toEqual([]);
    expect(south.nextSignal).toBeNull();
  });

  it('crossing the diamond adds the other track of the crossing as a conflict', () => {
    const states = { ...graph.defaultSwitchStates(), J: 'reverse' as const, K: 'reverse' as const };
    const route = routeAhead(graph, signal('O2'), states);
    expect(route.status).toBe('ok');
    expect(route.edges).toEqual(['e_swj_x', 'e_x_swk', 'e_out_n']);
    expect(route.conflicts.sort()).toEqual(['e_swg_x', 'e_x_swl']);
  });

  it('is blocked when a trailing switch is set against the movement', () => {
    const route = routeAhead(graph, signal('S3'), graph.defaultSwitchStates());
    expect(route.status).toBe('blocked');
  });
});

describe('computeAspects', () => {
  it('shows green everywhere along the straight through route on an empty station', () => {
    const aspects = aspectsWith();
    expect(aspects.get('AP1')).toBe('green');
    expect(aspects.get('IN')).toBe('green');
    expect(aspects.get('H')).toBe('green');
    expect(aspects.get('T1')).toBe('green');
    expect(aspects.get('T2')).toBe('green');
    expect(aspects.get('O1')).toBe('green');
    expect(aspects.get('O2')).toBe('green');
  });

  it('shows red when the next section has a train on it', () => {
    expect(aspectsWith({}, ['e_t']).get('T1')).toBe('red');
    expect(aspectsWith({}, ['e_swa_swc']).get('H')).toBe('red');
  });

  it('shows red when a switch in the next section is set against the route', () => {
    expect(aspectsWith().get('S3')).toBe('red');
    expect(aspectsWith({ L: 'reverse' }).get('O2')).toBe('red');
  });

  it('shows yellow when the next section is clear but the one after has a train', () => {
    expect(aspectsWith({}, ['e_t']).get('H')).toBe('yellow');
    expect(aspectsWith({}, [], ['T2']).get('T1')).toBe('yellow');
    expect(aspectsWith({ E: 'reverse' }).get('T1')).toBe('yellow');
  });

  it('shows green two sections before a red signal', () => {
    expect(aspectsWith({ E: 'reverse' }).get('H')).toBe('green');
  });

  it('holds trains at the entrance while the inbound track is occupied', () => {
    const aspects = aspectsWith({}, ['e_in']);
    expect(aspects.get('IN')).toBe('red');
    expect(aspects.get('AP3')).toBe('yellow');
    expect(aspects.get('AP2')).toBe('green');
    expect(aspectsWith({}, ['e_home_swa']).get('IN')).toBe('yellow');
  });

  it('holds departing trains when the outbound track is still occupied', () => {
    const aspects = aspectsWith({}, ['e_out_s']);
    expect(aspects.get('O2')).toBe('red');
    expect(aspects.get('T2')).toBe('yellow');
    expect(aspects.get('O1')).toBe('green');
  });

  it('lets only one train use the diamond at a time', () => {
    // Upper line crossing to the south exit while the lower line crosses to the north exit.
    const states = { G: 'reverse', L: 'reverse', J: 'reverse', K: 'reverse' } as const;
    expect(aspectsWith(states).get('O1')).toBe('green');
    expect(aspectsWith(states).get('O2')).toBe('green');
    // A train on the upper diagonal blocks the lower route through the diamond.
    expect(aspectsWith(states, ['e_swg_x']).get('O2')).toBe('red');
    expect(aspectsWith(states, ['e_x_swl']).get('O2')).toBe('red');
    // The straight routes do not touch the diamond.
    expect(aspectsWith({}, ['e_swg_x', 'e_x_swl']).get('O2')).toBe('green');
    expect(aspectsWith({}, ['e_swj_x', 'e_x_swk']).get('O1')).toBe('green');
  });

  it('re-routes the home signal when the ladder is thrown', () => {
    const aspects = aspectsWith({ A: 'reverse', B: 'reverse', D: 'reverse' });
    expect(aspects.get('H')).toBe('green');
    expect(aspects.get('E1')).toBe('green');
    expect(aspects.get('S1')).toBe('green');
    expect(aspects.get('S2')).toBe('red');
    expect(aspects.get('E2')).toBe('yellow');
  });

  it('every platform and the through line have an incoming and an outgoing light', () => {
    for (const platform of centralStation.platforms) {
      const n = platform.id.slice(1);
      expect(graph.signalByFromEdge.get(platform.edge)?.id).toBe(`S${n}`);
      expect(centralStation.signals.some((s) => s.id === `E${n}`)).toBe(true);
    }
    expect(graph.signalByFromEdge.get('e_t')?.id).toBe('T2');
    expect(graph.signalByFromEdge.get('e_swc_t')?.id).toBe('T1');
    expect(graph.signalByFromEdge.get('e_swd_swg')?.id).toBe('O1');
    expect(graph.signalByFromEdge.get('e_swe_swj')?.id).toBe('O2');
  });
});
