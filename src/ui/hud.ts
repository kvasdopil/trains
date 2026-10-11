import type { GameEvent, Simulation } from '../core/simulation';
import type { ScheduledTrain } from '../core/types';

export interface HudHandlers {
  onTogglePause: () => void;
  onCycleSpeed: () => void;
  onRestart: () => void;
}

export interface HudState {
  paused: boolean;
  speed: number;
}

export type SidebarPanel = 'none' | 'timetable' | 'log';

const formatClock = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
};

const formatPoints = (points: number): string => (points >= 0 ? `+${points}` : `${points}`);

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });

const formatEvent = (event: GameEvent): string => {
  switch (event.kind) {
    case 'arrival':
      return event.through
        ? `${event.train} approaching, through train, exit ${event.exit}`
        : `${event.train} approaching, booked for ${event.destination}, exit ${event.exit}`;
    case 'passing':
      return event.correct
        ? `${event.train} running through on ${event.track} ✓`
        : `${event.train} sent down the through line, missing its stop ✗`;
    case 'stopped':
      return event.correct
        ? `${event.train} stopped at ${event.platform} ✓`
        : `${event.train} stopped at ${event.platform} — wrong platform ✗`;
    case 'departed':
      return `${event.train} ready to depart ${event.platform}`;
    case 'left':
      return `${event.train} left via ${event.exit ?? '?'} (${formatPoints(event.points)})${event.correct ? '' : ' wrong track ✗'}${event.correctExit ? '' : ' wrong exit ✗'}`;
    case 'switch':
      return `Switch ${event.switchId} set to ${event.state}`;
    case 'switch-locked':
      return `Switch ${event.switchId} is locked by a train`;
    case 'signal-hold':
      return event.held
        ? `Signal ${event.signalId} held at red by dispatcher`
        : `Signal ${event.signalId} released`;
  }
};

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

/** DOM side panel: clock, score, timetable, event log and the end-of-shift overlay. */
export class Hud {
  private readonly score = byId<HTMLSpanElement>('score');
  private readonly progress = byId<HTMLSpanElement>('progress');
  private readonly timetable = byId<HTMLUListElement>('timetable');
  private readonly log = byId<HTMLUListElement>('log');
  private readonly pauseButton = byId<HTMLButtonElement>('btn-pause');
  private readonly speedButton = byId<HTMLButtonElement>('btn-speed');
  private readonly overlay = byId<HTMLDivElement>('overlay');
  private readonly overlayTitle = byId<HTMLHeadingElement>('overlay-title');
  private readonly overlayBody = byId<HTMLParagraphElement>('overlay-body');
  private readonly sidebar = byId<HTMLElement>('sidebar');
  private readonly panelButtons = [
    ...document.querySelectorAll<HTMLButtonElement>('.panel-toggle'),
  ];
  private panel: SidebarPanel = 'none';
  private lastListRefresh = -1;

  constructor(handlers: HudHandlers) {
    this.pauseButton.addEventListener('click', handlers.onTogglePause);
    this.speedButton.addEventListener('click', handlers.onCycleSpeed);
    byId<HTMLButtonElement>('btn-restart').addEventListener('click', handlers.onRestart);
    byId<HTMLButtonElement>('overlay-restart').addEventListener('click', handlers.onRestart);
    for (const button of this.panelButtons) {
      button.addEventListener('click', () => {
        const panel = button.dataset.panel as SidebarPanel | undefined;
        if (!panel) return;
        this.setPanel(this.panel === panel ? 'none' : panel);
      });
    }
    this.setPanel('none');
  }

  /** Show one side panel, or none; the toggle buttons float at the right when none is open. */
  setPanel(panel: SidebarPanel): void {
    this.panel = panel;
    this.sidebar.dataset.panel = panel;
    this.sidebar.classList.toggle('hidden', panel === 'none');
    for (const button of this.panelButtons) {
      button.classList.toggle('active', button.dataset.panel === panel);
    }
    this.forceRefresh();
  }

  update(sim: Simulation, state: HudState): void {
    this.score.textContent = String(sim.score);
    this.progress.textContent = `${sim.results.length} / ${sim.schedule.length}`;
    this.pauseButton.textContent = state.paused ? 'Resume' : 'Pause';
    this.pauseButton.classList.toggle('active', state.paused);
    this.speedButton.textContent = `${state.speed}x`;

    // The lists are cheap but not free; refresh them a few times per second.
    const bucket = Math.floor(sim.time * 4);
    if (bucket !== this.lastListRefresh) {
      this.lastListRefresh = bucket;
      if (this.panel === 'timetable') this.renderTimetable(sim);
      if (this.panel === 'log') this.renderLog(sim);
    }
  }

  forceRefresh(): void {
    this.lastListRefresh = -1;
  }

  showOverlay(title: string, body: string): void {
    this.overlayTitle.textContent = title;
    this.overlayBody.innerHTML = body;
    this.overlay.classList.remove('hidden');
  }

  hideOverlay(): void {
    this.overlay.classList.add('hidden');
  }

  private rowFor(sim: Simulation, plan: ScheduledTrain): string {
    const active = sim.trains.find((t) => t.id === plan.id);
    const result = sim.results.find((r) => r.id === plan.id);
    let state = 'pending';
    let status = `due ${formatClock(plan.at)}`;
    if (result) {
      state = result.correct && result.correctExit ? 'done' : 'wrong';
      const late = result.delaySeconds >= 1 ? `, ${Math.round(result.delaySeconds)}s late` : '';
      const via = result.servedPlatform ?? (result.viaThrough ? 'T' : '—');
      const ok = result.correct && result.correctExit;
      status = `${via}/${result.exitTaken ?? '?'} ${ok ? '✓' : '✗'} ${formatPoints(result.points)}${late}`;
    } else if (active) {
      state = 'active';
      if (!active.stops) {
        status =
          active.speed === 0
            ? 'held at signal'
            : active.viaThrough
              ? 'running through'
              : 'approaching';
      } else if (active.status === 'dwelling') {
        status = `at ${active.servedPlatform ?? '?'} · ${Math.ceil(active.dwellRemaining)}s`;
      } else if (active.servedPlatform) {
        status = active.speed === 0 ? 'waiting to depart' : 'departing';
      } else {
        status = active.speed === 0 ? 'held at signal' : 'approaching';
      }
    } else if (plan.at <= sim.time) {
      state = 'queued';
      status = 'waiting for entry track';
    }
    return `<li class="row ${state}">
      <span class="id">${escapeHtml(plan.id)}</span>
      <span class="plat ${plan.destination}">${plan.destination}</span><span class="exit">→${plan.exit}</span>
      <span class="status">${escapeHtml(status)}</span>
    </li>`;
  }

  private renderTimetable(sim: Simulation): void {
    const rows = [...sim.schedule].sort((a, b) => a.at - b.at).map((p) => this.rowFor(sim, p));
    this.timetable.innerHTML = rows.join('');
  }

  private renderLog(sim: Simulation): void {
    const recent = sim.events.slice(-8).reverse();
    this.log.innerHTML = recent
      .map(
        (e) =>
          `<li class="${e.kind}"><span class="time">${formatClock(e.time)}</span> ${escapeHtml(formatEvent(e))}</li>`,
      )
      .join('');
  }
}
