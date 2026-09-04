---
id: contracts/core-purity
type: contract
title: What must never appear in src/core, and what breaks if it does?
covers: [src/core/step.ts, src/core/world.ts, src/core/grid.ts, src/core/rng.ts, src/core/hash.ts, src/core/types.ts]
exports: [step, createWorld, buildGrid, createRng, hashState, canonicalise]
depends_on: [decisions/0001-typescript-isomorphic-engine, decisions/0002-sync-ticks-async-reasoning, contracts/step-function]
updated: 2026-09-05
---

# Purity rules for `src/core`

**When to open this page.** Before adding any import to `src/core`, and before
adding a field to `WorldState`. Every rule here fails *silently* when broken —
that is why they are written down rather than left to taste.

## The rules, and the failure each one prevents

| never | what breaks |
|---|---|
| `node:fs`, `node:crypto`, `process`, `fetch` | compiles here, fails in the browser bundle at runtime, usually on the deployed page — decision [`0001`](../decisions/0001-typescript-isomorphic-engine.md) |
| `Date.now()`, `performance.now()` | the run stops being reproducible. Time is `state.tick`. |
| `Math.random()` | unseeded, so replay diverges. Draw from `state.rngState` via `createRng` and write the advanced state back. |
| `Math.sin`, `Math.cos`, `Math.pow`, `Math.exp` | ECMA-262 leaves their precision to the implementation, so two engines can disagree and replay breaks. `+ - * /` and `Math.sqrt` are IEEE-754 exact — stay inside them. |
| mutating the input state | `step` must return a new state; the old one still hashes the same afterwards. There is a test. |
| sorting by arrival order | nondeterministic. Ties break on stable keys — dot id, topic name. |

## Two rules that are easy to forget

**Adding a field to `WorldState`?** Add it to `canonicalise` in `hash.ts` in
the same commit. Otherwise two different worlds hash identically and the
determinism tests pass on a lie — the worst failure available to this code,
because it looks exactly like success.

**Adding a rule that can refuse an intent?** Emit an `intent-rejected` event
with a reason. Never throw, never drop it silently. Refusal is how a dot
learns its action failed.

## See also

- [`contracts/step-function.md`](step-function.md) — the guarantees of `step`
- [`concepts/world-state.md`](../concepts/world-state.md)
