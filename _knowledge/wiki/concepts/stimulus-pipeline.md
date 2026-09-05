---
id: concepts/stimulus-pipeline
type: concept
title: How does news reach a dot, and why as weather rather than as a message?
covers: [src/core/grid.ts, src/core/percept.ts, src/core/step.ts]
exports: [stimulusPressureAt, buildPercept, step, ArrivingStimulus]
depends_on: [contracts/news, concepts/percept, concepts/world-state]
updated: 2026-09-05
---

# The stimulus pipeline

**When to open this page.** Before changing how stimuli are felt, or when
wondering why a dot cannot read a headline.

## A stimulus lands, it is not delivered

`step` takes an optional list of arrivals. Each lands at a position drawn from
the world's own RNG — the first rule to draw from it, so `rngState` advances
and is written back. That is what makes a replay put the same news in the same
place.

From then on it is **pressure**: felt across `stimulusRadius` cells with linear
falloff, decaying every tick. A dot standing inside it feels topic pressure and
nothing else — no title, no source, no valence.

## Marks and news are one sensation

`buildPercept` merges the mark grid with stimulus pressure before choosing the
strongest topics and the pull direction. A dot cannot tell whether another dot
left the pressure or the world outside did, and does not need to.

## The radius is large on purpose

The first version used a radius of 3. Measured: on a 64×36 world that is
**1.2% of the cells**, and twelve dots essentially never walk into it — news
would have been decoration. It is 10 now, reaching about 14% of the world, and
a test asserts that fraction stays above 10%.

Raising it was only affordable because pressure is **computed on demand by
distance** rather than materialised into the grid. Materialising is
O(radius²) per stimulus per tick; this is O(stimuli) at the few cells anyone
actually looks at.

## Stimuli outlast marks

`stimulusDecay` 0.992 against `markDecay` 0.985. Deliberate: news should
outlive the trails it provokes, or a dot can never follow one to its source
before it is gone. A test holds that ordering.

## Measured, with a stubbed source

200 ticks, 12 dots, 10 stimuli: **10 of 12 dots were inside some news at any
moment**, and marks grew from 0 to 14 alongside. Live feeds are blocked from
the development environment, so this used real headlines through a stubbed
source — see [`contracts/news.md`](../contracts/news.md).

## What NOT to do

- **Do not put the title in the percept.** It blows the token budget and undoes
  the quantisation the cache will depend on.
- **Do not materialise stimulus pressure into the grid.** See above; it caps
  the radius at a uselessly small value.
- **Do not inject a stimulus by mutating the state.** Pass it to `step` as an
  arrival, so placement stays deterministic and replayable.

## See also

- [`contracts/news.md`](../contracts/news.md)
- [`concepts/percept.md`](percept.md)
