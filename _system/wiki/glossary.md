---
id: glossary
type: concept
title: What does each word in this project mean?
depends_on: []
updated: 2026-09-04
---

# Glossary

**When to open this page.** Before naming anything, and whenever two terms
below feel interchangeable. Several pairs here are easy to confuse; fixing
them now costs nothing, fixing them later costs a global rename.

Anchors on this page are link targets: other pages reference `glossary#mark`.

---

## dot

An agent in the world. Has a position, energy, a mood, a personality, an
`intention`, and its own model reference. Descended from the mascot on the
portfolio (`ottobit/portfolio`, `script.js`), but with a decision loop
instead of pure physics.

## tick

One discrete step of the world. Every tick is deterministic: the same seed and
the same policies produce byte-identical state. Reasoning does **not** happen
inside a tick — see [`decisions/0002`](decisions/0002-sync-ticks-async-reasoning.md).

## world state

Everything the world is at a given tick: dots, marks, grid, stimuli, RNG
state. Owned exclusively by the engine. **No dot ever writes to it.**

## intent

A *proposed* effect, emitted by a dot's action during a tick ("I want to move
north"). Intents are collected and applied by the engine at the end of the
tick, in deterministic order. An intent may be clamped or rejected.

## intention

**Not the same as an intent.** A dot's current short plan, with a horizon of
tens of ticks ("head toward the strongest `ai` mark"). Produced by a
`deliberation`, executed cheaply every tick. One intention emits many intents
over its lifetime.

## mark

Something a dot leaves in space: `{pos, kind, topic, strength, createdTick}`.
`strength` decays every tick. Marks are the **only** channel between dots.
Placing a mark where one of the same kind and topic already exists
*reinforces* it rather than duplicating it.

## stigmergy

Indirect coordination through traces left in a shared environment, rather
than through messages. Dots coordinate this way and only this way. Named
after the mechanism in social insects.

## grid / cell

A coarse spatial partition of the world. Each cell aggregates mark strength
per topic, so a dot can perceive its surroundings in O(1) instead of scanning
every mark. The grid is also what makes a `percept` small enough to quantize
and cache.

## news source

An external, public, keyless HTTP feed the world reads from — Hacker News,
Hugging Face, Wikipedia pageviews, Open-Meteo, NASA APOD, GitHub commits.
Yields `RawItem`s.

## enricher

Turns a `RawItem` into a `Stimulus` by assigning topics, valence and
intensity. Runs **once per batch of items, shared by every dot** — never per
dot. See [`decisions/0005`](decisions/0005-enrich-news-once.md).

## stimulus

An enriched news item inside the world: `{id, sourceId, title, url, topics[],
valence, intensity, arrivedTick}`. A stimulus lands in the world like weather
— it creates topic pressure in a region and decays. A dot does not read a
headline; it feels the pressure.

## percept

Exactly what a dot sees when it perceives: its own state, the mark aggregates
in the 3×3 cells around it, the nearest visible dots (id, colour, distance,
direction — **never** their internals), the stimuli active in its cell, and
its own recent memory. The percept **is** the prompt, so its compactness is a
design constraint, not a refinement. Target: under 400 tokens.

## salience

How much a stimulus matters to a particular dot:
`dot(dot.interests, stimulus.topics) * stimulus.intensity`. High salience is
also what triggers a `deliberation` — the two are the same mechanism.

## reactive layer

What a dot does every tick with pure code and no model: move, decay, follow a
gradient, execute its current `intention`. Most of a dot's behaviour lives
here.

## deliberation

One model call that replaces a dot's `intention`. Rare and budgeted, never
per-tick. While deliberating a dot keeps acting on its previous intention, so
model latency is never world latency.

## reasoning

Loose, informal word for what a model does. **Prefer `deliberation`** in code
and page titles — it names the bounded, budgeted operation rather than the
vague activity.

## policy

How a dot turns a `percept` into an action. `ScriptedPolicy` (pure heuristic,
no model), `ModelPolicy` (a model call), `ReplayPolicy` (replays a run log).

## LanguageModel

The transport layer only: it speaks to an endpoint and returns a completion.
It knows nothing about dots. Prompt construction lives in the core. See
[`decisions/0004`](decisions/0004-two-layer-inference.md).

## run log

Append-only JSONL, one line per tick, recording the state hash, the events,
and **every model response**. It is what makes a run with real models
reproducible, and it is the primary immutable source in `_system/raw/runs/`.

## replay

Re-running a recorded run by feeding its logged model responses back through
`ReplayPolicy`. Produces the identical state hash. This is what lets a run
driven by real models be shown on a static public page with no backend — see
[`decisions/0001`](decisions/0001-typescript-isomorphic-engine.md).

---

## See also

- [`index.md`](index.md) — the catalogue of every page
- [`decisions/`](decisions/) — why the design is what it is
