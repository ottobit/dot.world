---
id: findings/diagram-corrections
type: finding
title: Which three things does the published diagram get wrong, and what should replace them?
sources: [_knowledge/raw/portfolio/dot-world-diagram.svg]
depends_on: [decisions/0002-sync-ticks-async-reasoning, decisions/0003-engine-owns-state, decisions/0005-enrich-news-once]
updated: 2026-09-05
---

# Correcting the published diagram

**When to open this page.** You are redrawing `dot-world-diagram.svg` on the
portfolio, or wondering why the picture and the code disagree.

`dot-world-diagram.svg` (kept verbatim in
[`raw/portfolio/`](../../raw/portfolio/dot-world-diagram.svg) as the source
this project started from) draws a loop labelled:

> `News feed` → `Perceive` → `Reason` → `Decide` → `Act` → `next tick`,
> with `Act` — `writes` → `World state (shared)` — `read by every dot`.

Three of those are contradicted by the code, deliberately. The contradiction
has been recorded in [`log.md`](../log.md) since the first day and never
resolved, because the diagram is an immutable source here, not a
specification. Fixing it belongs to the portfolio.

**a. `Reason` and `Decide` do not sit inside the per-tick loop.**
The tick loop is `Perceive → Act`. Deliberation is an asynchronous branch that,
when it returns, replaces the *intention* `Act` is already executing. Read
literally, the drawn loop is one model call per dot per tick — 48 calls a
second at twelve dots and four ticks per second. Decision
[`0002`](../decisions/0002-sync-ticks-async-reasoning.md).

**b. `Act` does not write to the world state. It emits an intent.**
The engine collects intents and applies them at end of tick in deterministic
order. That is why there are no concurrent writes to resolve: there is no
concurrency, only ordering. Decision
[`0003`](../decisions/0003-engine-owns-state.md).

**c. News does not enter at `Perceive`.**
It goes `RawItem → Enrich → Stimulus → World`, once per batch and shared by
every dot. The *world* is what news changes; a dot perceives the world, and
never sees a headline. Decision
[`0005`](../decisions/0005-enrich-news-once.md).

**And one thing the diagram is missing entirely: the marks.** They are the
only channel between dots, and they do not appear anywhere on it.

The caption "Still taking shape" can go. The interaction model is decided and
implemented; what remains open is named in section 4.

---

## See also

- [`portfolio-handoff.md`](portfolio-handoff.md) — the rest of the handover
