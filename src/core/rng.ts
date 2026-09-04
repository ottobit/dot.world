/**
 * Seeded PRNG with a single 32-bit state word, so the whole generator fits in
 * `WorldState.rngState` and a run can be resumed or replayed exactly.
 *
 * mulberry32: not cryptographic and not meant to be — what a simulation needs
 * is that the same seed produces the same sequence on every engine, and that
 * the state serialises to one number.
 *
 * Deliberately not `Math.random()`: it cannot be seeded, which would cost the
 * determinism decision 0002 rests on.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
  /** Current state, to be written back into `WorldState`. */
  state(): number;
}

export function createRng(state: number): Rng {
  let s = state >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    nextInt: (maxExclusive: number): number => Math.floor(next() * maxExclusive),
    state: (): number => s,
  };
}

/**
 * Turns an arbitrary seed into a usable 32-bit state. A seed of 0 would leave
 * mulberry32 in a fine but surprising place, so it is folded like any other.
 */
export function seedToState(seed: number): number {
  let h = (seed | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
