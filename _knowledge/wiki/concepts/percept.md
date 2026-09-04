---
id: concepts/percept
type: concept
title: What exactly does a dot see, and why is it kept so small?
covers: [src/core/percept.ts]
exports: [Percept, PerceptNeighbour, buildPercept]
depends_on: [concepts/world-state, glossary#percept, glossary#salience]
updated: 2026-09-05
---

# The percept

**When to open this page.** Before adding a field to `Percept`. The budget is
the point of this page.

## What is in it

- **self** — id, cell, energy
- **around** — the three strongest topics in the 3x3 block, strongest first
- **pull** — the direction of the strongest topic's gradient, or null
- **neighbours** — up to three dots within eight cells: **id, colour, distance,
  direction, and nothing else**
- **lastOutcome** — what failed for this dot on the previous tick

## Why it is this small

**The percept is the prompt.** Its size is a design constraint, not a detail to
tidy up later. Target: under 400 tokens serialised, asserted by a test.

It is also quantised — positions become a cell, floats round to two decimals,
topics are ids rather than prose. That is what will make a deliberation cache
hit often enough to matter
([`0002`](../decisions/0002-sync-ticks-async-reasoning.md)): a continuous world
has no repeated states, a quantised one has many.

## No telepathy

A neighbour contributes id, colour, distance and direction. Not its energy, not
its intention, not what it is about to do. If dots could read each other,
[marks](../glossary.md#mark) would be pointless — and marks are the only
intended channel between them.

## What NOT to do

- **Do not put headline text in here.** News reaches a dot as topic pressure,
  not prose — [`0005`](../decisions/0005-enrich-news-once.md). Prose would blow
  the budget and undo the quantisation.
- **Do not raise the neighbour or topic limits to "give the model more
  context".** Cost scales with every dot on every deliberation; the limits are
  the budget.
- **Do not add an unrounded float.** It defeats cache quantisation silently —
  nothing breaks, the hit rate just quietly goes to zero.

## See also

- [`contracts/decision-policy.md`](../contracts/decision-policy.md)
