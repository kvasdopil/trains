import { Application } from 'pixi.js';

import './style.css';
import { centralStation } from './core/layouts/central-station';
import { generateSchedule } from './core/schedule';
import { Simulation } from './core/simulation';
import { COLORS, STAGE_HEIGHT, STAGE_WIDTH, StationRenderer } from './game/renderer';
import { Hud } from './ui/hud';

const FIXED_DT = 1 / 60;
const SPEEDS = [1, 2, 4] as const;
const TRAINS_PER_SHIFT = 14;

function createSimulation(seed: number): Simulation {
  const schedule = generateSchedule({
    seed,
    count: TRAINS_PER_SHIFT,
    platforms: centralStation.platforms.map((p) => p.id),
    throughTracks: centralStation.throughTracks.map((t) => t.id),
    exits: centralStation.exits.map((x) => x.id),
  });
  return new Simulation(centralStation, schedule);
}

async function main(): Promise<void> {
  const stageEl = document.getElementById('stage');
  if (!stageEl) throw new Error('Missing #stage');

  const app = new Application();
  await app.init({
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    background: COLORS.background,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  stageEl.appendChild(app.canvas);

  let seed = Date.now() % 100000;
  let sim = createSimulation(seed);
  let paused = false;
  let speedIndex = 0;
  let accumulator = 0;
  let overlayShown = false;

  const renderer = new StationRenderer(sim.graph, {
    onSwitchTap: (id) => {
      if (paused || sim.finished) return;
      sim.toggleSwitch(id);
      hud.forceRefresh();
    },
    onSignalTap: (id) => {
      if (paused || sim.finished) return;
      sim.toggleSignalHold(id);
      hud.forceRefresh();
    },
  });
  app.stage.addChild(renderer.root);

  const restart = (): void => {
    seed = (seed * 7919 + 17) % 100000;
    sim = createSimulation(seed);
    renderer.reset();
    paused = false;
    accumulator = 0;
    overlayShown = false;
    hud.hideOverlay();
    hud.forceRefresh();
  };

  const hud = new Hud({
    onTogglePause: () => {
      paused = !paused;
    },
    onCycleSpeed: () => {
      speedIndex = (speedIndex + 1) % SPEEDS.length;
    },
    onRestart: restart,
  });

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
      event.preventDefault();
      paused = !paused;
    }
  });

  app.ticker.add((ticker) => {
    const speed = SPEEDS[speedIndex] ?? 1;
    if (!paused && !sim.finished) {
      accumulator += Math.min(ticker.deltaMS, 100) / 1000;
      const scaledDt = FIXED_DT / speed;
      while (accumulator >= scaledDt) {
        sim.step(FIXED_DT);
        accumulator -= scaledDt;
      }
    }
    renderer.update(sim);
    hud.update(sim, { paused, speed });

    if (sim.finished && !overlayShown) {
      overlayShown = true;
      const correct = sim.results.filter((r) => r.correct).length;
      const late = sim.results.filter((r) => r.delaySeconds >= 1).length;
      hud.showOverlay(
        'Shift complete',
        `Final score <b>${sim.score}</b>. ${correct} of ${sim.results.length} trains were routed correctly, ${late} ran late.`,
      );
    }
  });
}

main().catch((error: unknown) => {
  console.error(error);
});
