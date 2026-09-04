---
id: contracts/decision-policy
type: contract
title: What must a DecisionPolicy do, and why is ScriptedPolicy not a test double?
covers: [src/policies/types.ts, src/policies/scripted.ts, src/policies/replay.ts, src/sim/loop.ts]
exports: [DecisionPolicy, Decision, DecisionRequest, Personality, createScriptedPolicy, makePersonalities, createReplayPolicy, ReplayMismatch, advance]
depends_on: [decisions/0004-two-layer-inference, decisions/0002-sync-ticks-async-reasoning, concepts/percept]
updated: 2026-09-05
---

# Contract — `DecisionPolicy`

**When to open this page.** Before adding a policy, before deleting
`ScriptedPolicy`, or when wondering where prompts are allowed to live.

```ts
interface DecisionPolicy {
  readonly id: string;
  decide(requests: readonly DecisionRequest[]): Promise<readonly Decision[]>;
}
```

Layer 2 of the split in [`0004`](../decisions/0004-two-layer-inference.md).
Percept in, action out. It knows nothing about HTTP, endpoints or prompts.

**`decide` takes the whole tick's requests at once**, not one at a time, so a
model-backed policy can batch them into one call without the caller changing
shape.

## Guarantees

1. One `Decision` per `DecisionRequest`, in the same order.
2. A `Decision` carries intents plus a short `rationale`. The engine ignores
   the rationale; the viewer's inspector shows it.
3. A policy holds no state between ticks. `ScriptedPolicy` draws from a seed
   derived from the dot id and the tick, so a replay needs nothing carried over.

## The three implementations

| policy | what it is for |
|---|---|
| `ScriptedPolicy` | pure heuristic, no model. See below. |
| `ReplayPolicy` | returns what a run log recorded for that tick |
| `ModelPolicy` | not built yet — step 7 of the work order |

**`ScriptedPolicy` is not a test double.** It is the fallback when the
deliberation budget is exhausted, the policy behind a demo with no backend, and
the reason the whole world runs offline. Removing it as "dead code" breaks all
three at once and none of them fail loudly.

## Personality lives here, not in the world state

`interests` and `restlessness` are what a dot *knows*, so they belong above the
engine — see [`concepts/world-state.md`](../concepts/world-state.md).
`makePersonalities` derives them from the world seed rather than storing them,
so a run is fully described by seed plus dot count.

## What NOT to do

- **Do not put prompt text in a `LanguageModel`.** The core builds prompts. Two
  providers wording the same prompt differently would mean any comparison
  between them measures the prompts, not the models.
- **Do not delete `ScriptedPolicy`.** See above.
- **Do not let a policy keep state between ticks.** Replay would need that
  state too, and it is not in the log.
- **Do not let `ReplayPolicy` return nothing for a missing tick.** It throws
  `ReplayMismatch`, because silence looks exactly like a world where every dot
  chose to do nothing — a very confusing way to find a truncated log.

## A trap this policy already fell into

The first version only marked where the dot already felt interest, and interest
only exists where a mark already is. Nobody ever laid the first one, so a
1000-tick run created **zero marks** and the stigmergic layer stayed empty
forever. The bootstrap branch exists for that, and a test guards it.

## See also

- [`contracts/run-log.md`](run-log.md) — what replay reads
- [`concepts/percept.md`](../concepts/percept.md) — what goes in
