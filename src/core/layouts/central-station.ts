import type { StationLayout } from '../types';

/**
 * Feature 1/2 station: a single inbound track fans out through three facing switches into
 * three passenger platforms and a centre through line, then converges through three
 * trailing switches onto the outbound track. All traffic runs west -> east.
 *
 *            ┌─ B ─── P1 ───┐
 *   IN ─ H ─ A       P2 ─── D ── G ──╮╭── K ── N ▶   (north exit)
 *            └─ C ─── T ──── E ── J ──╯╰── L ── S ▶   (south exit)
 *                     P3 ───┘           X = diamond crossing between G/J and K/L
 *
 * T is the through line (no stop). IN, O1 and O2 are signals. The approach in front of IN is
 * off stage and split into four block sections (AP1–AP3 signals), each long enough for one
 * train, so trains queue there. Every train is booked for a track and an exit.
 *                     P3 ───┘
 */
export const centralStation: StationLayout = {
  name: 'Central Station',
  nodes: [
    // Off-stage approach: four block sections where trains queue in front of the entrance.
    { id: 'n_ap0', pos: { x: -690, y: 300 } },
    { id: 'n_ap1', pos: { x: -510, y: 300 } },
    { id: 'n_ap2', pos: { x: -330, y: 300 } },
    { id: 'n_ap3', pos: { x: -150, y: 300 } },
    { id: 'n_in', pos: { x: 30, y: 300 } },
    { id: 'n_home', pos: { x: 180, y: 300 } },
    { id: 'n_swa', pos: { x: 240, y: 300 } },
    { id: 'n_swb', pos: { x: 320, y: 220 } },
    { id: 'n_swc', pos: { x: 320, y: 300 } },
    { id: 'n_p1s', pos: { x: 400, y: 140 } },
    { id: 'n_p2s', pos: { x: 400, y: 220 } },
    { id: 'n_ts', pos: { x: 400, y: 300 } },
    { id: 'n_p3s', pos: { x: 400, y: 380 } },
    { id: 'n_p1e', pos: { x: 800, y: 140 } },
    { id: 'n_p2e', pos: { x: 800, y: 220 } },
    { id: 'n_te', pos: { x: 800, y: 300 } },
    { id: 'n_p3e', pos: { x: 800, y: 380 } },
    { id: 'n_swd', pos: { x: 860, y: 220 } },
    { id: 'n_swe', pos: { x: 860, y: 300 } },
    // crossover with a diamond crossing
    { id: 'n_swg', pos: { x: 950, y: 220 } },
    { id: 'n_swj', pos: { x: 950, y: 300 } },
    { id: 'n_x', pos: { x: 990, y: 260 } },
    { id: 'n_swk', pos: { x: 1030, y: 220 } },
    { id: 'n_swl', pos: { x: 1030, y: 300 } },
    { id: 'n_out_n', pos: { x: 1170, y: 220 } },
    { id: 'n_out_s', pos: { x: 1170, y: 300 } },
  ],
  edges: [
    { id: 'e_ap1', from: 'n_ap0', to: 'n_ap1' },
    { id: 'e_ap2', from: 'n_ap1', to: 'n_ap2' },
    { id: 'e_ap3', from: 'n_ap2', to: 'n_ap3' },
    { id: 'e_ap4', from: 'n_ap3', to: 'n_in' },
    { id: 'e_in', from: 'n_in', to: 'n_home' },
    { id: 'e_home_swa', from: 'n_home', to: 'n_swa' },
    // left ladder
    { id: 'e_swa_swb', from: 'n_swa', to: 'n_swb' },
    { id: 'e_swa_swc', from: 'n_swa', to: 'n_swc' },
    { id: 'e_swb_p1', from: 'n_swb', to: 'n_p1s' },
    { id: 'e_swb_p2', from: 'n_swb', to: 'n_p2s' },
    { id: 'e_swc_t', from: 'n_swc', to: 'n_ts' },
    { id: 'e_swc_p3', from: 'n_swc', to: 'n_p3s' },
    // platforms and through line
    { id: 'e_p1', from: 'n_p1s', to: 'n_p1e' },
    { id: 'e_p2', from: 'n_p2s', to: 'n_p2e' },
    { id: 'e_t', from: 'n_ts', to: 'n_te' },
    { id: 'e_p3', from: 'n_p3s', to: 'n_p3e' },
    // right ladder
    { id: 'e_p1_swd', from: 'n_p1e', to: 'n_swd' },
    { id: 'e_p2_swd', from: 'n_p2e', to: 'n_swd' },
    { id: 'e_t_swe', from: 'n_te', to: 'n_swe' },
    { id: 'e_p3_swe', from: 'n_p3e', to: 'n_swe' },
    { id: 'e_swd_swg', from: 'n_swd', to: 'n_swg' },
    { id: 'e_swe_swj', from: 'n_swe', to: 'n_swj' },
    // crossover: straights and the two diagonals through the diamond
    { id: 'e_swg_swk', from: 'n_swg', to: 'n_swk' },
    { id: 'e_swj_swl', from: 'n_swj', to: 'n_swl' },
    { id: 'e_swg_x', from: 'n_swg', to: 'n_x' },
    { id: 'e_x_swl', from: 'n_x', to: 'n_swl' },
    { id: 'e_swj_x', from: 'n_swj', to: 'n_x' },
    { id: 'e_x_swk', from: 'n_x', to: 'n_swk' },
    // exits
    { id: 'e_out_n', from: 'n_swk', to: 'n_out_n' },
    { id: 'e_out_s', from: 'n_swl', to: 'n_out_s' },
  ],
  switches: [
    {
      id: 'A',
      node: 'n_swa',
      toe: 'e_home_swa',
      normal: 'e_swa_swc',
      reverse: 'e_swa_swb',
      labelOffset: { x: 0, y: 22 },
    },
    {
      id: 'B',
      node: 'n_swb',
      toe: 'e_swa_swb',
      normal: 'e_swb_p2',
      reverse: 'e_swb_p1',
      labelOffset: { x: 4, y: 22 },
    },
    {
      id: 'C',
      node: 'n_swc',
      toe: 'e_swa_swc',
      normal: 'e_swc_t',
      reverse: 'e_swc_p3',
      labelOffset: { x: -16, y: 20 },
    },
    {
      id: 'D',
      node: 'n_swd',
      toe: 'e_swd_swg',
      normal: 'e_p2_swd',
      reverse: 'e_p1_swd',
      labelOffset: { x: -4, y: 22 },
    },
    {
      id: 'E',
      node: 'n_swe',
      toe: 'e_swe_swj',
      normal: 'e_t_swe',
      reverse: 'e_p3_swe',
      labelOffset: { x: 16, y: 20 },
    },
    {
      id: 'G',
      node: 'n_swg',
      toe: 'e_swd_swg',
      normal: 'e_swg_swk',
      reverse: 'e_swg_x',
      labelOffset: { x: 0, y: -20 },
    },
    {
      id: 'J',
      node: 'n_swj',
      toe: 'e_swe_swj',
      normal: 'e_swj_swl',
      reverse: 'e_swj_x',
      labelOffset: { x: 0, y: 22 },
    },
    {
      id: 'K',
      node: 'n_swk',
      toe: 'e_out_n',
      normal: 'e_swg_swk',
      reverse: 'e_x_swk',
      labelOffset: { x: 0, y: -20 },
    },
    {
      id: 'L',
      node: 'n_swl',
      toe: 'e_out_s',
      normal: 'e_swj_swl',
      reverse: 'e_x_swl',
      labelOffset: { x: 0, y: 22 },
    },
  ],
  crossings: [
    {
      id: 'X',
      node: 'n_x',
      pairs: [
        { from: 'e_swg_x', to: 'e_x_swl' },
        { from: 'e_swj_x', to: 'e_x_swk' },
      ],
    },
  ],
  signals: [
    // Approach block signals (off stage): one train per section.
    { id: 'AP1', node: 'n_ap1', fromEdge: 'e_ap1', side: 'above' },
    { id: 'AP2', node: 'n_ap2', fromEdge: 'e_ap2', side: 'above' },
    { id: 'AP3', node: 'n_ap3', fromEdge: 'e_ap3', side: 'above' },
    // Entrance signal: admits trains from the approach onto the inbound track.
    { id: 'IN', node: 'n_in', fromEdge: 'e_ap4', side: 'above' },
    // Home signal: protects the switch ladder.
    { id: 'H', node: 'n_home', fromEdge: 'e_in', side: 'above' },
    // Incoming lights: protect each platform track and the through line.
    { id: 'E1', node: 'n_p1s', fromEdge: 'e_swb_p1', side: 'above' },
    { id: 'E2', node: 'n_p2s', fromEdge: 'e_swb_p2', side: 'above' },
    { id: 'T1', node: 'n_ts', fromEdge: 'e_swc_t', side: 'above' },
    { id: 'E3', node: 'n_p3s', fromEdge: 'e_swc_p3', side: 'above' },
    // Outgoing lights: protect the exit ladder.
    { id: 'S1', node: 'n_p1e', fromEdge: 'e_p1', side: 'above' },
    { id: 'S2', node: 'n_p2e', fromEdge: 'e_p2', side: 'above' },
    { id: 'T2', node: 'n_te', fromEdge: 'e_t', side: 'above' },
    { id: 'S3', node: 'n_p3e', fromEdge: 'e_p3', side: 'above' },
    // Exit signals in front of the crossover: protect the crossover and the exit tracks.
    { id: 'O1', node: 'n_swg', fromEdge: 'e_swd_swg', side: 'above' },
    { id: 'O2', node: 'n_swj', fromEdge: 'e_swe_swj', side: 'below' },
  ],
  platforms: [
    { id: 'P1', name: 'Platform 1', edge: 'e_p1' },
    { id: 'P2', name: 'Platform 2', edge: 'e_p2' },
    { id: 'P3', name: 'Platform 3', edge: 'e_p3' },
  ],
  throughTracks: [{ id: 'T', name: 'Through line', edge: 'e_t' }],
  entry: 'e_ap1',
  exits: [
    { id: 'N', name: 'North', edge: 'e_out_n' },
    { id: 'S', name: 'South', edge: 'e_out_s' },
  ],
};
