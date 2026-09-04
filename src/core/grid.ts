/**
 * The per-cell topic aggregate a dot actually perceives.
 *
 * Derived from `marks` on demand and never stored in `WorldState`: marks are
 * the truth, and a stored index is one more thing that can drift out of step
 * with it. Recomputing is cheap because marks are bounded — they decay, and a
 * new mark near an existing one of the same topic reinforces it instead of
 * adding another.
 */
import type { Mark, Topic, Vec2 } from './types.js';

/** Topic to summed strength, for one cell. */
export type CellTopics = ReadonlyMap<Topic, number>;

export interface Grid {
  readonly width: number;
  readonly height: number;
  /** Aggregate for one cell. Out-of-bounds cells read as empty, never throw. */
  at(cx: number, cy: number): CellTopics;
  /** Aggregate over the 3x3 block centred on a cell — what a dot sees around it. */
  neighbourhood(cx: number, cy: number): CellTopics;
}

const EMPTY: CellTopics = new Map();

export function cellOf(pos: Vec2): { cx: number; cy: number } {
  return { cx: Math.floor(pos.x), cy: Math.floor(pos.y) };
}

export function buildGrid(marks: readonly Mark[], width: number, height: number): Grid {
  const cells = new Map<number, Map<Topic, number>>();
  for (const m of marks) {
    const { cx, cy } = cellOf(m.pos);
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
    const key = cy * width + cx;
    let cell = cells.get(key);
    if (!cell) {
      cell = new Map();
      cells.set(key, cell);
    }
    cell.set(m.topic, (cell.get(m.topic) ?? 0) + m.strength);
  }

  const at = (cx: number, cy: number): CellTopics => {
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) return EMPTY;
    return cells.get(cy * width + cx) ?? EMPTY;
  };

  return {
    width,
    height,
    at,
    neighbourhood: (cx: number, cy: number): CellTopics => {
      const out = new Map<Topic, number>();
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          for (const [topic, strength] of at(cx + dx, cy + dy)) {
            out.set(topic, (out.get(topic) ?? 0) + strength);
          }
        }
      }
      return out;
    },
  };
}

/**
 * The strongest topic in a cell block, or null when there is nothing to feel.
 * Ties break on the topic name so the answer never depends on map ordering.
 */
export function strongestTopic(cell: CellTopics): { topic: Topic; strength: number } | null {
  let best: { topic: Topic; strength: number } | null = null;
  for (const [topic, strength] of cell) {
    if (best === null || strength > best.strength || (strength === best.strength && topic < best.topic)) {
      best = { topic, strength };
    }
  }
  return best;
}
