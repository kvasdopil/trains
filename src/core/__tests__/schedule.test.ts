import { describe, expect, it } from 'vitest';

import { generateSchedule } from '../schedule';

describe('generateSchedule', () => {
  it('is deterministic for a seed and mixes through and stopping trains', () => {
    const options = {
      seed: 42,
      count: 40,
      platforms: ['P1', 'P2', 'P3'],
      throughTracks: ['T'],
      exits: ['N', 'S'],
    };
    const a = generateSchedule(options);
    const b = generateSchedule(options);
    expect(a).toEqual(b);
    const through = a.filter((t) => t.destination === 'T');
    expect(through.length).toBeGreaterThan(0);
    expect(through.length).toBeLessThan(a.length);
    expect(through.every((t) => t.dwell === 0)).toBe(true);
    const stopping = a.filter((t) => t.destination !== 'T');
    expect(stopping.every((t) => t.dwell >= 9 && t.dwell <= 12)).toBe(true);
    // Longer trains dwell longer.
    const sorted = [...stopping].sort((x, y) => x.length - y.length);
    expect(sorted[0]?.dwell ?? 0).toBeLessThanOrEqual(sorted[sorted.length - 1]?.dwell ?? 0);
    expect(a.every((t, i) => i === 0 || t.at > (a[i - 1]?.at ?? 0))).toBe(true);
    expect(a.some((t) => t.exit === 'N')).toBe(true);
    expect(a.some((t) => t.exit === 'S')).toBe(true);
  });

  it('bunches arrivals so several trains overlap in the station', () => {
    const trains = generateSchedule({
      seed: 3,
      count: 30,
      platforms: ['P1', 'P2', 'P3'],
      exits: ['N'],
    });
    const gaps = trains.slice(1).map((t, i) => t.at - (trains[i]?.at ?? 0));
    expect(gaps.some((g) => g <= 12)).toBe(true);
    expect(gaps.some((g) => g >= 13)).toBe(true);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(9);
    // Count how many trains are expected inside the station (nominal 25 s + dwell) at once.
    const windows = trains.map((t) => [t.at, t.at + 25 + t.dwell] as const);
    const peak = Math.max(
      ...windows.map(([start]) => windows.filter(([s, e]) => s <= start && start < e).length),
    );
    expect(peak).toBeGreaterThanOrEqual(3);
  });

  it('keeps a clearance gap between trains booked for the same platform', () => {
    const platforms = ['P1', 'P2', 'P3'];
    for (const seed of [1, 2, 3, 42, 99]) {
      const trains = generateSchedule({
        seed,
        count: 40,
        platforms,
        throughTracks: ['T'],
        exits: ['N', 'S'],
      });
      for (const platform of platforms) {
        const times = trains.filter((t) => t.destination === platform).map((t) => t.at);
        for (let i = 1; i < times.length; i += 1) {
          expect((times[i] ?? 0) - (times[i - 1] ?? 0)).toBeGreaterThanOrEqual(30);
        }
      }
      expect(trains.every((t, i) => i === 0 || t.at >= (trains[i - 1]?.at ?? 0))).toBe(true);
    }
  });

  it('honours a custom platform gap by pushing arrivals later', () => {
    const trains = generateSchedule({
      seed: 5,
      count: 6,
      platforms: ['P1'],
      exits: ['S'],
      platformGap: 50,
    });
    trains
      .slice(1)
      .forEach((t, i) => expect(t.at - (trains[i]?.at ?? 0)).toBeGreaterThanOrEqual(50));
  });

  it('never books through trains when no through track is given', () => {
    const trains = generateSchedule({ seed: 7, count: 20, platforms: ['P1'], exits: ['S'] });
    expect(trains.every((t) => t.destination === 'P1')).toBe(true);
  });
});
