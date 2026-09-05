# Wiki index

The catalogue of every page. **Read this first**, then open only what you
need. Maintained on every Ingest and Query — see
[`AGENTS.md`](../../AGENTS.md).

Concepts, contracts and recipes arrive with the modules they describe — see
the approved-plan rule in [`AGENTS.md`](../../AGENTS.md). `src/core`, `src/policies`, `src/sim`,
`src/node` and `src/web` exist; there is no news ingestion and no model yet.

## Reference

| page | what it answers |
|---|---|
| [`glossary.md`](glossary.md) | What does each word in this project mean? |
| [`log.md`](log.md) | What happened, and when? |

## Decisions

Read these **before** proposing a redesign. Each one carries a
"What NOT to do" section.

| page | what it answers |
|---|---|
| [`decisions/0001-typescript-isomorphic-engine.md`](decisions/0001-typescript-isomorphic-engine.md) | Why is the engine one TypeScript package that runs in both Node and the browser? |
| [`decisions/0002-sync-ticks-async-reasoning.md`](decisions/0002-sync-ticks-async-reasoning.md) | Why does the world advance in synchronous ticks while reasoning happens outside them? |
| [`decisions/0003-engine-owns-state.md`](decisions/0003-engine-owns-state.md) | Why does no dot ever write to the world state? |
| [`decisions/0004-two-layer-inference.md`](decisions/0004-two-layer-inference.md) | Why is inference split into a transport layer and a decision layer? |
| [`decisions/0005-enrich-news-once.md`](decisions/0005-enrich-news-once.md) | Why is a news item enriched once for everyone instead of read by each dot? |

## Concepts

| page | what it answers |
|---|---|
| [`concepts/world-state.md`](concepts/world-state.md) | What is in the world state, and what is deliberately not? |
| [`concepts/intent-vs-intention.md`](concepts/intent-vs-intention.md) | What is the difference between an intent and an intention? |
| [`concepts/percept.md`](concepts/percept.md) | What exactly does a dot see, and why is it kept so small? |

## Contracts

| page | what it answers |
|---|---|
| [`contracts/step-function.md`](contracts/step-function.md) | What are the guarantees of `step()`, and what breaks if you relax them? |
| [`contracts/core-purity.md`](contracts/core-purity.md) | What must never appear in `src/core`, and what breaks if it does? |
| [`contracts/decision-policy.md`](contracts/decision-policy.md) | What must a `DecisionPolicy` do, and why is `ScriptedPolicy` not a test double? |
| [`contracts/run-log.md`](contracts/run-log.md) | What is in a run log, and what makes a replay trustworthy? |
| [`contracts/viewer.md`](contracts/viewer.md) | What does the viewer run, and why is it not a rendering of a simulation? |

## Recipes

*(empty)*

## Sources

Summaries of the immutable material in [`../raw/`](../raw/).

| page | what it answers |
|---|---|
| [`sources/2026-09-04-initial-plan.md`](sources/2026-09-04-initial-plan.md) | What did the initial Dot World plan decide, and what did it leave open? |
| [`sources/2026-09-05-first-scripted-run.md`](sources/2026-09-05-first-scripted-run.md) | What did the first full scripted run show? |

## Findings

Answers worth keeping, filed back from Query.

*(empty)*
