/**
 * What a dot actually sees. Deliberately narrow, and deliberately small: the
 * percept *is* the prompt, so its size is a design constraint rather than a
 * detail to tidy up later. Target is under 400 tokens serialised.
 *
 * A neighbour contributes its id, colour, distance and direction and nothing
 * else. No internals, no intentions, no energy — telepathy would make marks
 * pointless, and marks are the only intended channel between dots.
 */
import { cellOf, type Grid } from './grid.js';
import type { Dot, DotId, Topic, WorldEvent, WorldState } from './types.js';

/** Rounded so two nearly-equal percepts quantise to the same cache key. */
const round = (n: number): number => Math.round(n * 100) / 100;

export interface PerceptNeighbour {
  readonly id: DotId;
  readonly colour: string;
  readonly dist: number;
  readonly dir: readonly [number, number];
}

export interface Percept {
  readonly tick: number;
  readonly self: {
    readonly id: DotId;
    readonly cell: readonly [number, number];
    readonly energy: number;
  };
  /** Strongest topics in the 3x3 block around the dot, strongest first. */
  readonly around: readonly { readonly topic: Topic; readonly strength: number }[];
  /** Direction of the strongest topic gradient, if there is one to feel. */
  readonly pull: { readonly topic: Topic; readonly dir: readonly [number, number] } | null;
  readonly neighbours: readonly PerceptNeighbour[];
  /** Outcomes from the previous tick that named this dot. How it learns it failed. */
  readonly lastOutcome: readonly string[];
}

const MAX_AROUND = 3;
const MAX_NEIGHBOURS = 3;
const VISION = 8;

/**
 * The pull a dot feels: neighbouring cells' strength for one topic, summed as
 * vectors away from the dot's own cell. Returns null when nothing is strong
 * enough to be worth moving toward.
 */
function gradient(grid: Grid, cx: number, cy: number, topic: Topic): readonly [number, number] | null {
  let dx = 0;
  let dy = 0;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      if (ox === 0 && oy === 0) continue;
      const s = grid.at(cx + ox, cy + oy).get(topic) ?? 0;
      dx += ox * s;
      dy += oy * s;
    }
  }
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;
  return [round(dx / len), round(dy / len)];
}

export function buildPercept(
  state: WorldState,
  dot: Dot,
  grid: Grid,
  previousEvents: readonly WorldEvent[],
): Percept {
  const { cx, cy } = cellOf(dot.pos);

  const around = [...grid.neighbourhood(cx, cy)]
    // Ties break on topic name so the order never depends on map iteration.
    .sort((a, b) => (b[1] === a[1] ? (a[0] < b[0] ? -1 : 1) : b[1] - a[1]))
    .slice(0, MAX_AROUND)
    .map(([topic, strength]) => ({ topic, strength: round(strength) }));

  const strongest = around[0];
  const dir = strongest ? gradient(grid, cx, cy, strongest.topic) : null;

  const neighbours = state.dots
    .filter((o) => o.id !== dot.id)
    .map((o) => {
      const ddx = o.pos.x - dot.pos.x;
      const ddy = o.pos.y - dot.pos.y;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy);
      return { o, ddx, ddy, dist };
    })
    .filter((n) => n.dist <= VISION)
    .sort((a, b) => (a.dist === b.dist ? (a.o.id < b.o.id ? -1 : 1) : a.dist - b.dist))
    .slice(0, MAX_NEIGHBOURS)
    .map(({ o, ddx, ddy, dist }): PerceptNeighbour => ({
      id: o.id,
      colour: o.colour,
      dist: round(dist),
      dir: dist === 0 ? [0, 0] : [round(ddx / dist), round(ddy / dist)],
    }));

  const lastOutcome: string[] = [];
  for (const e of previousEvents) {
    if (!('dotId' in e) || e.dotId !== dot.id) continue;
    if (e.kind === 'intent-rejected') lastOutcome.push(`${e.intent} refused: ${e.reason}`);
    else if (e.kind === 'move-clamped') lastOutcome.push('move cut short');
  }

  return {
    tick: state.tick,
    self: { id: dot.id, cell: [cx, cy], energy: round(dot.energy) },
    around,
    pull: strongest && dir ? { topic: strongest.topic, dir } : null,
    neighbours,
    lastOutcome,
  };
}
