import { describe, expect, it } from 'vitest';

import { TrackGraph } from '../graph';
import { centralStation } from '../layouts/central-station';

describe('TrackGraph.nextEdge', () => {
  const graph = new TrackGraph(centralStation);
  const states = graph.defaultSwitchStates();

  it('follows a plain node to its single outgoing edge', () => {
    expect(graph.nextEdge('e_in', states)).toEqual({
      kind: 'edge',
      edge: graph.edge('e_home_swa'),
    });
  });

  it('sends a facing movement down the selected leg', () => {
    expect(graph.nextEdge('e_home_swa', states)).toMatchObject({ edge: { id: 'e_swa_swc' } });
    expect(graph.nextEdge('e_home_swa', { ...states, A: 'reverse' })).toMatchObject({
      edge: { id: 'e_swa_swb' },
    });
  });

  it('allows a trailing movement only when the switch is set for that leg', () => {
    expect(graph.nextEdge('e_t_swe', states)).toMatchObject({ edge: { id: 'e_swe_swj' } });
    expect(graph.nextEdge('e_p3_swe', states)).toEqual({
      kind: 'blocked',
      reason: 'switch-not-set',
    });
    expect(graph.nextEdge('e_p3_swe', { ...states, E: 'reverse' })).toMatchObject({
      edge: { id: 'e_swe_swj' },
    });
  });

  it('reports the exit at the end of each outbound track', () => {
    expect(graph.nextEdge('e_out_n', states)).toEqual({ kind: 'exit' });
    expect(graph.nextEdge('e_out_s', states)).toEqual({ kind: 'exit' });
  });

  it('carries a train straight across the diamond crossing', () => {
    expect(graph.nextEdge('e_swg_x', states)).toMatchObject({ edge: { id: 'e_x_swl' } });
    expect(graph.nextEdge('e_swj_x', states)).toMatchObject({ edge: { id: 'e_x_swk' } });
    expect(graph.crossingEdges(centralStation.crossings[0]!)).toEqual([
      'e_swg_x',
      'e_x_swl',
      'e_swj_x',
      'e_x_swk',
    ]);
  });

  it('computes edge geometry from node positions', () => {
    expect(graph.edge('e_p1').length).toBe(400);
    expect(graph.edge('e_swa_swb').length).toBeCloseTo(Math.hypot(80, 80));
    expect(graph.pointAlong(graph.edge('e_p1'), 100)).toEqual({ x: 500, y: 140 });
  });

  it('distinguishes stopping and through destinations', () => {
    expect(graph.isStoppingDestination('P2')).toBe(true);
    expect(graph.isStoppingDestination('T')).toBe(false);
    expect(() => graph.isStoppingDestination('P9')).toThrow();
  });
});
