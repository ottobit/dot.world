/**
 * Building a world. Pure: everything that varies comes from the seed, so two
 * calls with the same arguments produce byte-identical states.
 */
import { createRng, seedToState } from './rng.js';
import type { Dot, WorldConfig, WorldState } from './types.js';
import { DEFAULT_CONFIG } from './types.js';

/**
 * Vivid, toy-like colours, carried over from the mascot on the portfolio so a
 * clone in Dot World reads like a clone of `dot`. Assigned round-robin rather
 * than at random: with twelve dots and eight colours, random assignment makes
 * duplicates common and the world harder to read.
 */
export const DOT_COLOURS = [
  '#dc2626', '#ea580c', '#ca8a04', '#16a34a',
  '#0891b2', '#2563eb', '#7c3aed', '#db2777',
] as const;

export interface CreateWorldOptions {
  readonly seed: number;
  readonly dotCount: number;
  readonly config?: Partial<WorldConfig>;
}

export function resolveConfig(partial?: Partial<WorldConfig>): WorldConfig {
  return { ...DEFAULT_CONFIG, ...partial };
}

export function createWorld(options: CreateWorldOptions): WorldState {
  const config = resolveConfig(options.config);
  const rng = createRng(seedToState(options.seed));
  const dots: Dot[] = [];

  for (let i = 0; i < options.dotCount; i++) {
    dots.push({
      // Zero-padded so ids sort lexicographically in the same order they were
      // created. Intent ordering is by dot id (decision 0003), and "dot-10"
      // sorting before "dot-2" would make the tie-break read as arbitrary.
      id: `dot-${String(i).padStart(3, '0')}`,
      pos: { x: rng.next() * config.width, y: rng.next() * config.height },
      colour: DOT_COLOURS[i % DOT_COLOURS.length] ?? DOT_COLOURS[0],
      energy: config.maxEnergy,
      saying: null,
      sayingSinceTick: -1,
    });
  }

  return {
    tick: 0,
    seed: options.seed,
    rngState: rng.state(),
    width: config.width,
    height: config.height,
    dots,
    marks: [],
    nextMarkSeq: 0,
  };
}
