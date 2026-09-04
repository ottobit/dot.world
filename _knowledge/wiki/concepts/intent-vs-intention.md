---
id: concepts/intent-vs-intention
type: concept
title: What is the difference between an intent and an intention?
covers: [src/core/types.ts, src/core/step.ts]
exports: [Intent, IntentKind, RejectReason, WorldEvent, orderIntents]
depends_on: [glossary#intent, glossary#intention, contracts/step-function]
updated: 2026-09-04
---

# Intent vs intention

**When to open this page.** Whenever the two words feel interchangeable. They
are not, and the whole execution model sits on the difference.

| | intent | intention |
|---|---|---|
| what | a *proposed* effect for this tick | a dot's current short plan |
| lives | in the engine, for one tick | above the engine, for tens of ticks |
| made by | executing an intention | a [deliberation](../glossary.md#deliberation) |
| example | `{kind:'move', dx:0.3, dy:-0.1}` | "head toward the strongest `ai` mark" |
| may be refused | yes, routinely | no — it is a plan, not a request |

**One intention emits many intents over its life.** That is the whole point:
the expensive thing (a model call producing an intention) happens rarely, and
the cheap thing (intents executing it) happens every tick. Collapse the two and
you are back to one model call per dot per tick, which decision
[`0002`](../decisions/0002-sync-ticks-async-reasoning.md) exists to prevent.

## The four intents

`move`, `mark`, `rest`, `say`. `follow` from the milestone list is **not** an
intent: it is an intention that emits `move` intents, and it belongs to the
policy layer.

## Refusal is normal

An intent can be refused for `unknown-dot`, `not-enough-energy`,
`empty-topic` or `duplicate-intent`. Each emits an `intent-rejected` event
naming the dot, the kind and the reason — which is how a dot finds out its
action failed and can plan around it.

Clamping is not refusal. A move past the speed limit or into a wall is applied
at the limit and reported as `move-clamped`.

## What NOT to do

- **Do not name a variable `intent` when it holds a plan**, or the other way
  round. The rename is cheap now and expensive once both words are in fifty
  files.
- **Do not add an intent that carries prose.** `say` is the one exception and
  it is capped; everything else uses topic ids — the percept is the prompt,
  and it has a token budget.
- **Do not make an intent that cannot be refused.** If a rule cannot fail, it
  is not an intent, it is a world rule and belongs in the end-of-tick pass.

## See also

- [`contracts/step-function.md`](../contracts/step-function.md) — ordering and guarantees
- [`concepts/world-state.md`](world-state.md)
