---
id: sources/2026-09-04-initial-plan
type: source
title: What did the initial Dot World plan decide, and what did it leave open?
sources: [_knowledge/raw/plans/2026-09-04-initial-plan.md]
depends_on: [glossary, decisions/0001-typescript-isomorphic-engine]
updated: 2026-09-04
---

# Source — initial plan (2026-09-04)

**When to open this page.** Before proposing an architecture change, or when
you need to know whether something was already argued and settled. This is the
plan the repository was built from.

Source: [`raw/plans/2026-09-04-initial-plan.md`](../../raw/plans/2026-09-04-initial-plan.md)
— written in Italian, kept verbatim. Summarised here in English, per
[`AGENTS.md`](../../../AGENTS.md).

## What it settled

Five decisions, each with its own page and its own "What NOT to do":

| decision | in one line |
|---|---|
| [`0001`](../decisions/0001-typescript-isomorphic-engine.md) | one TypeScript package, engine pure enough to run in Node and in a browser |
| [`0002`](../decisions/0002-sync-ticks-async-reasoning.md) | synchronous ticks for the world; deliberation is async, budgeted, and rare |
| [`0003`](../decisions/0003-engine-owns-state.md) | the engine owns all state; dots emit intents and never write |
| [`0004`](../decisions/0004-two-layer-inference.md) | `LanguageModel` (transport) separated from `DecisionPolicy` (decision) |
| [`0005`](../decisions/0005-enrich-news-once.md) | news enriched once per batch and shared, never per dot |

The plan's central argument, which the diagram it started from does not make:
**most of what a dot does must not involve a model at all.** Read literally,
`Perceive → Reason → Decide → Act` every tick is 48 model calls a second at 12
dots and 4 ticks per second. The correction is not "call the model less
often"; it is moving the boundary between code and model.

## What it proposed but has not been acted on

- **Three changes to the published diagram** (`raw/portfolio/dot-world-diagram.svg`):
  `Reason`/`Decide` move out of the per-tick loop; `Act` emits an intent
  instead of writing; news reaches the world through `Enrich → Stimulus`
  rather than entering `Perceive`. The diagram lives in a different
  repository and is an immutable source here — see the contradiction recorded
  in [`log.md`](../log.md).
- **A dot's memory as a wiki of its own** (plan §8.7). The same pattern this
  repository uses for its own knowledge is arguably the design for a dot's
  memory: stimuli as immutable sources, beliefs as the wiki, Query as the
  deliberation itself, an index read first to keep the percept small. It
  would replace the plan's own ring buffer, which is amnesia by design.
  Explicitly deferred: re-evaluate with real numbers, not before.

## The milestone it defines

12 dots, a 64×36 grid, 4 ticks per second, five actions (`move`, `mark`,
`follow`, `rest`, `say`), two news sources with the keyword enricher, and
`ScriptedPolicy` for everyone by default. The part that makes it a portfolio
piece rather than a toy: **click a dot and see its exact percept, the prompt
sent, the raw response, and the decision.**

## Work order

Scaffold → wiki → `core` with determinism tests → `ScriptedPolicy` and the
headless runner → canvas viewer and replay → news → `LanguageModel` and the
deliberation budget → inspector → a run against Ollama with real numbers →
first full Lint.

Steps 1 and 2 are done. Step 3 (`core`) is next, and the plan is explicit that
the determinism tests come **before** anything is visible on screen.

## See also

- [`log.md`](../log.md) — what has been ingested and linted so far
- [`../decisions/`](../decisions/) — the five pages this plan produced
