---
id: findings/diagram-corrections
type: finding
title: Which three things did the published diagram get wrong, and what replaced them?
sources: [_knowledge/raw/portfolio/dot-world-diagram.svg, _knowledge/raw/portfolio/dot-world-diagram-2026-09-05-shipped.svg]
depends_on: [decisions/0002-sync-ticks-async-reasoning, decisions/0003-engine-owns-state, decisions/0005-enrich-news-once]
updated: 2026-09-05
---

# Correcting the published diagram

**When to open this page.** You want to know why the published picture once
disagreed with the code, and what was drawn instead.

**Status: applied.** All four corrections shipped on 2026-09-05 in
`ottobit/portfolio#136`. The redrawn file is kept verbatim as
[`raw/portfolio/dot-world-diagram-2026-09-05-shipped.svg`](../../raw/portfolio/dot-world-diagram-2026-09-05-shipped.svg).
What follows is the reasoning, which outlives the fix: anyone redrawing that
diagram again needs it.

`dot-world-diagram.svg` (kept verbatim in
[`raw/portfolio/`](../../raw/portfolio/dot-world-diagram.svg) as the source
this project started from) draws a loop labelled:

> `News feed` → `Perceive` → `Reason` → `Decide` → `Act` → `next tick`,
> with `Act` — `writes` → `World state (shared)` — `read by every dot`.

Three of those were contradicted by the code, deliberately. The contradiction
was recorded in [`log.md`](../log.md) from the first day and left standing for
weeks, because the diagram is an immutable source here, not a specification —
fixing it belonged to the portfolio, and that is where it was fixed.

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

The caption "Still taking shape" is gone, replaced by "On a budget, not every
tick" — the cost argument is the thing worth a legend, and it is the reason
`Deliberate` left the loop. The interaction model is decided and implemented;
what remains open is named in
[`portfolio-handoff.md`](portfolio-handoff.md#4-what-the-page-must-not-claim).

---

## See also

- [`portfolio-handoff.md`](portfolio-handoff.md) — the rest of the handover
