---
id: decisions/0002-sync-ticks-async-reasoning
type: decision
title: Why does the world advance in synchronous ticks while reasoning happens outside them?
depends_on: [glossary#tick, glossary#deliberation, glossary#intention]
sources: [_knowledge/raw/plans/2026-09-04-initial-plan.md]
updated: 2026-09-04
---

# 0002 — Synchronous ticks, asynchronous reasoning

**When to open this page.** Before giving each dot its own async loop, before
awaiting a model call inside the tick, or before raising the per-tick model
budget.

**Status:** accepted.

## Context

Read literally, the original sketch (`_knowledge/raw/portfolio/dot-world-diagram.svg`)
says every dot runs `Perceive → Reason → Decide → Act` on every tick. With 12
dots at 4 ticks per second that is 48 model calls a second. This is not a cost
to optimise later: it puts the boundary between code and model in the wrong
place.

## Decision

The world advances in **discrete synchronous ticks**. Behaviour is layered:

| layer | frequency | cost | what it does |
|---|---|---|---|
| reactive | every tick | pure code | movement, decay, collisions, following a gradient |
| intention | every tick | pure code | executes the current plan (horizon 20–60 ticks) |
| deliberation | on event | one model call | **replaces** the intention |

A dot has `mind: idle | thinking | committed`. While thinking it **keeps
acting** on its previous intention, so model latency is never world latency.

A dot deliberates when: a stimulus is salient to it, its intention failed or
expired, its energy is low, or a staleness timer fires (~60s).

Cost is bounded by a **global concurrency cap** (`DeliberationScheduler`, 4
requests in flight). Candidates are ranked by salience; whoever misses a slot
falls back to `ScriptedPolicy`. Cost becomes a function of wall-clock time,
**not of N**. Cache, batching and per-personality cadences help, but this is
the lever that actually scales.

## Consequences

- `step(state, intents, rng)` is a pure function. The world is inspectable at
  every instant and diffable between ticks.
- Determinism survives real models because the run log records **every model
  response**; `ReplayPolicy` re-emits them in order.
- Adding dots does not add model cost. It adds contention for slots, which
  degrades gracefully into scripted behaviour.

## What NOT to do

- **Do not give each dot its own async loop.** It looks more "agentic" and it
  destroys determinism, and with it reproducible tests, snapshots, recording
  and replay — which is what makes the public demo possible at all. The
  failure is silent: tests pass locally and flake in CI.
- **Do not `await` a model call inside `step()`.** The tick must stay
  synchronous and pure. Deliberation results arrive between ticks.
- **Do not remove the concurrency cap** because "it is fast enough with 12
  dots". The cap is the only thing making cost independent of N.
- **Do not delete `ScriptedPolicy` as dead code.** It is the fallback when a
  slot is missed, the policy of the public demo, and the way the whole world
  runs with no model at all. See [`0004`](0004-two-layer-inference.md).

## See also

- [`0003`](0003-engine-owns-state.md) — why the tick can stay pure
- [`0004`](0004-two-layer-inference.md) — where model calls actually happen
