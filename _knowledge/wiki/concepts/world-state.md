---
id: concepts/world-state
type: concept
title: What is in the world state, and what is deliberately not?
covers: [src/core/types.ts, src/core/world.ts, src/core/grid.ts]
exports: [WorldState, Dot, Mark, WorldConfig, DEFAULT_CONFIG, createWorld, resolveConfig, buildGrid, cellOf, strongestTopic]
depends_on: [contracts/step-function, glossary#world-state, glossary#mark]
updated: 2026-09-05
---

# The world state

**When to open this page.** Before adding a field to `WorldState`, or when you
need to know what a dot can and cannot see.

Owned exclusively by the engine. No dot writes to it — decision
[`0003`](../decisions/0003-engine-owns-state.md).

## What is in it

| field | why |
|---|---|
| `tick` | the world's only clock. There is no `Date.now()` in the engine. |
| `seed`, `rngState` | a run is resumable and replayable from the state alone |
| `width`, `height` | the world in cells; positions are continuous inside the box |
| `dots` | id, position, colour, energy, what it is saying |
| `marks` | the stigmergic layer, and the only channel between dots |
| `stimuli` | news that has entered the world, with its title kept for the viewer and the log — never for a dot |
| `nextMarkSeq` | mark ids are sequential, so they are stable across a replay |

## What is deliberately not in it

- **The per-cell topic grid.** Derived from `marks` by `buildGrid` on demand,
  never stored. Marks are the truth; a stored index is one more thing that can
  drift away from it. Marks stay bounded because they decay and because a new
  mark near an existing one of the same topic reinforces it, so recomputing is
  cheap.
- **Stimulus pressure.** Not in the grid either, and not for the same reason:
  it is computed by distance on demand, because materialising it is
  O(radius²) per stimulus per tick and that cost is what forces the radius
  down to a value where news never reaches anyone. See
  [`concepts/stimulus-pipeline.md`](stimulus-pipeline.md).
- **Anything a dot knows.** Beliefs, intentions and memory live above the
  engine. The state is the world, not the minds in it.
- **Wall-clock time, real dates, network results.** They would make `step`
  impure and replay impossible.

## The energy budget is a constraint nobody chose explicitly

With `DEFAULT_CONFIG`, moving costs `0.4` and resting returns `2`. Sustained
movement therefore needs roughly **one rest in every six ticks**; marking, at
`3`, costs more than seven moves.

Observed on a 1000-tick run of twelve dots against a stand-in that rests one
tick in ten: **4172 of 12558 events were refusals for want of energy** — a
third of the run spent exhausted. The engine is behaving correctly; the
numbers simply impose a rhythm.

This is not tuned yet, and it should be tuned against a real policy rather
than against a stand-in. It matters beyond balance: how often a dot must rest
interacts with how often it can afford to deliberate
([`0002`](../decisions/0002-sync-ticks-async-reasoning.md)).

## What NOT to do

- **Do not add a field without extending `canonicalise` in `hash.ts`.** Two
  different worlds would hash the same and the determinism tests would pass on
  a lie.
- **Do not store the grid.** If a profile ever says recomputing it is the
  bottleneck, cache it outside the state, keyed by tick.
- **Do not put a dot's beliefs in here.** They belong to the policy layer, and
  putting them here would let every dot read every other dot's mind — which
  makes marks pointless.

## See also

- [`contracts/step-function.md`](../contracts/step-function.md)
- [`concepts/intent-vs-intention.md`](intent-vs-intention.md)
