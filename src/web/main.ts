/**
 * The viewer. Runs the same engine as the headless runner — `src/core` and
 * `src/sim` import nothing from Node, which is the whole point of decision
 * 0001 — so what you watch here is not a rendering of a simulation that ran
 * elsewhere. It is the simulation.
 *
 * Two modes:
 *   - live (default): the engine runs in the page with `ScriptedPolicy`
 *   - replay: `?replay=<url>` loads a run log and re-plays its decisions
 *
 * Replay is what lets a run driven by real models be shown on a static page
 * with no backend and no API key anywhere near the browser.
 */
import { buildGrid } from '../core/grid.js';
import { buildPercept, type Percept } from '../core/percept.js';
import type { WorldConfig, WorldEvent, WorldState } from '../core/types.js';
import { createWorld, resolveConfig } from '../core/world.js';
import { createReplayPolicy } from '../policies/replay.js';
import { createScriptedPolicy, makePersonalities, TOPICS } from '../policies/scripted.js';
import type { Decision, DecisionPolicy, Personality } from '../policies/types.js';
import { advance } from '../sim/loop.js';
import { draw, hitTest, THEMES, topicColour } from './render.js';

const SEED = 42;
const DOTS = 12;

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('canvas 2d context unavailable');

const el = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing element #${id}`);
  return found as T;
};
const statsEl = el('stats');
const legendEl = el('legend');
const inspectorEl = el('inspector');
const hintEl = el('inspector-hint');
const modeEl = el('mode');
const playPauseBtn = el<HTMLButtonElement>('playpause');

interface Session {
  state: WorldState;
  readonly config: WorldConfig;
  readonly policy: DecisionPolicy;
  readonly personalities: ReadonlyMap<string, Personality>;
  events: readonly WorldEvent[];
  decisions: readonly Decision[];
  /** Ticks available in replay mode; Infinity when running live. */
  readonly limit: number;
}

let session: Session;
let selected: string | null = null;
let running = true;
let speed = 2;
let strengthScale = 1;
let ticking = false;

async function buildSession(): Promise<Session> {
  const config = resolveConfig();
  const replayUrl = new URLSearchParams(location.search).get('replay');

  if (replayUrl) {
    const text = await (await fetch(replayUrl)).text();
    const lines = text.split('\n').filter((l) => l.length > 0);
    const header = JSON.parse(lines[0] as string) as {
      seed: number; dotCount: number; config: WorldConfig; policy: string;
    };
    const byTick = new Map<number, readonly Decision[]>();
    for (let i = 1; i < lines.length; i++) {
      const t = JSON.parse(lines[i] as string) as { tick: number; decisions: Decision[] };
      byTick.set(t.tick, t.decisions);
    }
    const state = createWorld({ seed: header.seed, dotCount: header.dotCount });
    modeEl.textContent = `replay · ${byTick.size} ticks · recorded with ${header.policy}`;
    return {
      state,
      config: header.config,
      policy: createReplayPolicy(byTick),
      personalities: makePersonalities(state.dots.map((d) => d.id), header.seed),
      events: [],
      decisions: [],
      limit: byTick.size,
    };
  }

  const state = createWorld({ seed: SEED, dotCount: DOTS });
  modeEl.textContent = 'live · scripted policy, no model';
  return {
    state,
    config,
    policy: createScriptedPolicy(config.maxEnergy),
    personalities: makePersonalities(state.dots.map((d) => d.id), SEED),
    events: [],
    decisions: [],
    limit: Number.POSITIVE_INFINITY,
  };
}

function resize(): void {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
  canvas.height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
}

function theme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEMES.dark : THEMES.light;
}

async function tick(): Promise<void> {
  if (session.state.tick >= session.limit) {
    running = false;
    playPauseBtn.textContent = 'Play';
    return;
  }
  const result = await advance(
    session.state, session.policy, session.personalities, session.events, session.config,
  );
  session.state = result.state;
  session.events = result.events;
  session.decisions = result.decisions;
  for (const m of session.state.marks) strengthScale = Math.max(strengthScale, m.strength);
}

function renderStats(): void {
  const s = session.state;
  const rows: [string, string][] = [
    ['tick', String(s.tick)],
    ['dots', String(s.dots.length)],
    ['marks', `${s.marks.length} alive of ${s.nextMarkSeq}`],
    ['events/tick', String(session.events.length)],
  ];
  statsEl.replaceChildren(
    ...rows.flatMap(([k, v]) => {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      return [dt, dd];
    }),
  );
}

/**
 * The inspector is what makes this a thing you can reason about rather than an
 * aquarium: the exact percept a dot saw, and the decision it produced.
 */
function renderInspector(): void {
  if (!selected) {
    inspectorEl.replaceChildren();
    hintEl.hidden = false;
    return;
  }
  const dot = session.state.dots.find((d) => d.id === selected);
  if (!dot) return;
  hintEl.hidden = true;

  const grid = buildGrid(session.state.marks, session.state.width, session.state.height);
  const percept: Percept = buildPercept(session.state, dot, grid, session.events, session.config);
  const decision = session.decisions.find((d) => d.dotId === selected);
  const personality = session.personalities.get(dot.id);

  const parts: HTMLElement[] = [];
  const head = document.createElement('p');
  head.className = 'sub';
  head.textContent = `${dot.id} · energy ${dot.energy.toFixed(1)}`;
  head.style.color = dot.colour;
  parts.push(head);

  const why = document.createElement('p');
  why.className = decision ? 'sub' : 'empty';
  why.textContent = decision ? `“${decision.rationale}”` : 'no decision yet';
  parts.push(why);

  for (const [label, value] of [
    ['Percept (this is the prompt)', percept],
    ['Decision', decision ?? null],
    ['Interests', personality?.interests ?? null],
  ] as const) {
    const h = document.createElement('h2');
    h.textContent = label;
    const pre = document.createElement('pre');
    pre.textContent = value === null ? '—' : JSON.stringify(value, null, 1);
    parts.push(h, pre);
  }
  inspectorEl.replaceChildren(...parts);
}

function frame(): void {
  draw(ctx!, session.state, { theme: theme(), selected, strengthScale });
  renderStats();
  renderInspector();
}

async function loop(): Promise<void> {
  if (running && !ticking) {
    ticking = true;
    for (let i = 0; i < speed; i++) await tick();
    ticking = false;
  }
  frame();
  requestAnimationFrame(() => void loop());
}

playPauseBtn.addEventListener('click', () => {
  running = !running;
  playPauseBtn.textContent = running ? 'Pause' : 'Play';
});
el('stepone').addEventListener('click', () => {
  running = false;
  playPauseBtn.textContent = 'Play';
  void tick();
});
el('restart').addEventListener('click', () => {
  void buildSession().then((s) => {
    session = s;
    strengthScale = 1;
    selected = null;
  });
});
el<HTMLSelectElement>('speed').addEventListener('change', (e) => {
  speed = Number((e.target as HTMLSelectElement).value);
});
canvas.addEventListener('click', (e) => {
  selected = hitTest(session.state, canvas, e.clientX, e.clientY);
});
window.addEventListener('resize', resize);

legendEl.replaceChildren(
  ...TOPICS.map((topic) => {
    const span = document.createElement('span');
    const sw = document.createElement('i');
    sw.className = 'swatch';
    sw.style.background = topicColour(topic);
    span.append(sw, document.createTextNode(topic));
    return span;
  }),
);

// A hook for the end-to-end test, and for anyone poking at the page in a
// console. Read-only by intent: the world is still owned by the engine.
// `ready` resolves once the first session exists, so a test never races the
// fetch a replay needs.
let markReady = (): void => {};
const ready = new Promise<void>((resolve) => { markReady = resolve; });
Object.defineProperty(window, 'dotWorld', {
  value: {
    ready,
    state: (): WorldState => session.state,
    select: (id: string): void => { selected = id; },
    running: (): boolean => running,
  },
});

// Wrapped rather than top-level await: the build target is deliberately kept
// at es2020 so older browsers still get the page, and top-level await is not
// available there.
void (async (): Promise<void> => {
  session = await buildSession();
  resize();
  markReady();
  void loop();
})();
