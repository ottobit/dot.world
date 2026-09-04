---
id: decisions/0003-engine-owns-state
type: decision
title: Why does no dot ever write to the world state?
depends_on: [glossary#intent, glossary#world-state, glossary#mark]
updated: 2026-09-04
---

# 0003 — The engine owns all state; dots emit intents

**When to open this page.** Before letting an action mutate anything, before
adding a lock, a queue or a transaction, or before wondering how concurrent
writes are resolved.

**Status:** accepted.

## Context

The original sketch has `Act` writing into the shared world state. Many dots
writing to one structure is the classic setup for conflicts, and the usual
answers (locks, CRDTs, last-write-wins) all add machinery.

## Decision

**The engine owns the state exclusively.** `Act` does not write — it emits an
**[intent](../glossary.md#intent)**, a *proposed* effect. The engine collects
every intent and applies them at the end of the tick in deterministic order.

```ts
step(state, intents, rng) -> { state, events }   // pure
```

Ordering is by `(priority, dotId)` — deterministic, never by arrival order.

Resolution rules, deliberately boring so they stay testable:

- **Movement:** the engine clamps speed and world bounds. Two dots may occupy
  the same cell; they are dots, not rigid bodies.
- **Marks:** placing a mark where one of the same `kind` and `topic` already
  exists **reinforces** it (`strength +=`) instead of duplicating it. This is
  the stigmergic accumulation rule, and it is why the mark list stays bounded.
- **Rejection is normal.** An intent that violates a rule is dropped and
  recorded as an event, so the dot can perceive that its action failed.

## Consequences

- Concurrent writes are not resolved — they do not exist. There is no
  concurrency, only ordering.
- Every state transition is one pure function, so it can be tested,
  snapshotted, hashed and diffed.
- What a dot perceives is never a half-applied state.

## What NOT to do

- **Do not hand a dot a mutable reference to the state**, not even for
  "reading convenience". Perception builds a fresh
  [percept](../glossary.md#percept); it does not expose the state object.
- **Do not add a mutex, a queue, or an async write path.** If you find
  yourself needing one, an intent has been applied outside `step()` — fix
  that instead.
- **Do not let dots read each other's internals.** A percept carries a
  neighbour's id, colour, distance and direction, and nothing more. Telepathy
  would make marks pointless, and marks are the only intended channel.
- **Do not sort intents by arrival order.** It is nondeterministic and breaks
  replay.

## See also

- [`0002`](0002-sync-ticks-async-reasoning.md) — why the tick is synchronous
- [`glossary#stigmergy`](../glossary.md#stigmergy)
