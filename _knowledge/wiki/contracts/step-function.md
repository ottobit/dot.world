---
id: contracts/step-function
type: contract
title: What are the guarantees of step(), and what breaks if you relax them?
covers: [src/core/step.ts, src/core/types.ts, src/core/hash.ts, src/core/rng.ts]
exports: [step, orderIntents, hashState, canonicalise, createRng, seedToState]
depends_on: [decisions/0002-sync-ticks-async-reasoning, decisions/0003-engine-owns-state, glossary#intent]
updated: 2026-09-04
---

# Contract — `step()`

**When to open this page.** Before changing anything in `src/core/step.ts`, or
before adding a rule that can refuse an intent.

```ts
step(state: WorldState, intents: readonly Intent[], config: WorldConfig)
  -> { state: WorldState; events: readonly WorldEvent[] }
```

## Guarantees

1. **Pure.** No clock, no I/O, no unseeded randomness. Two calls with equal
   arguments return equal results.
2. **The input is not mutated.** `hashState(before)` is unchanged after the
   call. Tested directly.
3. **Order never depends on arrival.** Intents are sorted by kind, then dot id,
   then arrival index — the last only to make the sort total. Shuffling the
   input array cannot change the outcome.
4. **One intent per dot per kind.** A dot may move and speak in one tick; a
   second `move` is rejected as `duplicate-intent`.
5. **Refusal is an event, not an exception.** Every rejection emits
   `intent-rejected` with a reason. Nothing throws.
6. **Clamping is not refusal.** A move beyond `maxSpeed` or outside the world
   is applied at the limit and reported as `move-clamped`, so a dot can learn
   about the wall.

## Application order, and why it is that order

`rest` → `move` → `mark` → `say`.

Rest resolves first so a dot that rests and moves in the same tick spends the
energy it just gained. Marking resolves after moving so a mark lands where the
dot ended up — which is what "I passed here" has to mean for
[stigmergy](../glossary.md#stigmergy) to work at all.

## Deviation from the plan, recorded

The plan sketched `step(state, intents, rng)`. The signature here takes
`config` instead and leaves the generator inside `state.rngState`. Passing a
live generator alongside a state that also stores its seed is two sources of
truth for the same thing, and the one in the argument would not survive
serialisation into a run log. No rule currently draws from it; when one does,
it must read from `state.rngState` and write the advanced state back.

## What NOT to do

- **Do not `await` inside `step`.** The tick is synchronous. Deliberation
  results arrive between ticks — decision 0002.
- **Do not let an action write to the state directly.** Emit an intent;
  `step` decides — decision 0003.
- **Do not add a `WorldState` field without extending `canonicalise`.** Two
  different worlds would hash identically and the determinism tests would pass
  on a lie — the worst possible failure for this file.
- **Do not throw on a bad intent.** A world that stops because one dot asked
  for something impossible is not a world.

## See also

- [`concepts/world-state.md`](../concepts/world-state.md) — what is in the state and why
- [`contracts/core-purity.md`](core-purity.md) — what must never appear in `src/core`
