# Wiki index

The catalogue of every page. **Read this first**, then open only what you
need. Maintained on every Ingest and Query — see
[`AGENTS.md`](../../AGENTS.md).

Nothing here yet describes code, because there is no code yet. Concepts,
contracts and recipes arrive with the modules they describe.

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

*(empty — pages arrive with the code they describe)*

## Contracts

*(empty — pages arrive with the interfaces they describe)*

## Recipes

*(empty)*

## Sources

Summaries of the immutable material in [`../raw/`](../raw/).

*(empty — the first will be the first real run log)*

## Findings

Answers worth keeping, filed back from Query.

*(empty)*
