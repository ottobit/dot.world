---
id: concepts/deliberation-budget
type: concept
title: What decides which dots get to think, and what does the cap actually buy?
covers: [src/policies/scheduler.ts]
exports: [createBudgetedPolicy, salience, SchedulerStats, BudgetedPolicy]
depends_on: [decisions/0002-sync-ticks-async-reasoning, contracts/language-model, concepts/stimulus-pipeline]
updated: 2026-09-05
---

# The deliberation budget

**When to open this page.** Before raising `maxInFlight`, before adding a
trigger, and before assuming a real model can drive this world today.

At most `maxInFlight` deliberations happen per tick (default 4). Candidates are
ranked; whoever misses a slot falls back to `ScriptedPolicy` and carries on.
**Cost is therefore a function of the cap, not of the number of dots** — adding
dots adds contention, which degrades into scripted behaviour rather than into a
larger bill.

## What makes a dot a candidate

| trigger | score | why |
|---|---|---|
| `action-failed` | 1e5 | something it tried did not work; it needs a new plan |
| `stale` | 1e4 | it has not thought in `stalenessTicks`, measured from first sight |
| `salient` | the salience | pressure it can feel, weighted by what it cares about |

**Salience is the same quantity as the salience of news to a dot.** They were
never two mechanisms, and keeping them one is what connects the news pipeline
to thinking at all.

Ties break on dot id, never on array order, so which dot gets the last slot is
reproducible.

## Two rules that were wrong and are recorded as such

**A newborn dot is not stale.** Defaulting "last deliberated" to `-Infinity`
made every dot fire the staleness rule on its first tick and spend the whole
budget before anything had happened. First sight now registers the tick.

**An exhausted dot is not a candidate at all.** It was one, at the *highest*
priority, on the reasoning that it had the most pressing question. That is
backwards: it has the least interesting one, because the answer is always
"rest" and the scripted layer already knows it. Measured over 300 ticks with
twelve dots: **1014 of 1146 deliberations were spent on it.**

## What the cap does not yet buy

The cap bounds how many calls happen per tick. It does **not** yet hide their
latency: `advance` awaits the policy, so a real model at half a second a call
would slow the world to a crawl rather than letting dots keep acting on their
previous plan.

Decision [`0002`](../decisions/0002-sync-ticks-async-reasoning.md) describes
the intended shape — `mind: idle | thinking | committed`, with an intention
carried across ticks and replaced when a deliberation returns. **That is not
built.** Saying the budget "makes model latency free" today would be false.

## Measured

300 ticks, 12 dots, echo model, cap 4: 1100 deliberations, 607 missed a slot,
1893 below threshold, 0 retries, 0 fallbacks. 1100 calls over 300 ticks is 3.67
per tick against a cap of 4 — the cap is the binding constraint, which is what
it is for.

## What NOT to do

- **Do not raise `maxInFlight` to make dots smarter.** It is the only thing
  keeping cost independent of N.
- **Do not add a trigger whose answer is already known.** See the exhausted-dot
  rule above; it cost 88% of the budget.
- **Do not claim latency is hidden.** It is not, yet.

## See also

- [`contracts/language-model.md`](../contracts/language-model.md)
