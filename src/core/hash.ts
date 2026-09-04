/**
 * A deterministic hash of the world state, used by the determinism tests and
 * by replay to prove a recorded run reproduces exactly.
 *
 * FNV-1a by hand rather than `node:crypto`: `src/core/` must stay importable
 * from a browser bundle (decision 0001), and this only needs to detect
 * difference, not resist an attacker.
 *
 * Numbers are serialised with `toString()`, which ECMA-262 defines as the
 * shortest round-tripping representation — so it is identical across engines,
 * unlike `toFixed` rounding or locale-aware formatting.
 */
import type { WorldState } from './types.js';

function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Canonical serialisation: fixed field order, no object key iteration. */
export function canonicalise(state: WorldState): string {
  const parts: string[] = [
    't', state.tick.toString(),
    's', state.seed.toString(),
    'r', state.rngState.toString(),
    'w', state.width.toString(),
    'h', state.height.toString(),
    'n', state.nextMarkSeq.toString(),
  ];
  for (const d of state.dots) {
    parts.push(
      'D', d.id, d.pos.x.toString(), d.pos.y.toString(), d.colour,
      d.energy.toString(), d.saying ?? '', d.sayingSinceTick.toString(),
    );
  }
  for (const m of state.marks) {
    parts.push(
      'M', m.id, m.pos.x.toString(), m.pos.y.toString(), m.topic,
      m.strength.toString(), m.createdTick.toString(), m.byDot,
    );
  }
  return parts.join(' ');
}

export function hashState(state: WorldState): string {
  return fnv1a(canonicalise(state)).toString(16).padStart(8, '0');
}
