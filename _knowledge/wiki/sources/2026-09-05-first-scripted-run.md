---
id: sources/2026-09-05-first-scripted-run
type: source
title: What did the first full scripted run show?
sources: [_knowledge/raw/runs/2026-09-05-scripted-seed42.jsonl]
depends_on: [contracts/run-log, contracts/decision-policy]
updated: 2026-09-05
---

# Source — first scripted run (2026-09-05)

**When to open this page.** For the first real numbers this project produced,
and for the bug the run found.

Source: [`raw/runs/2026-09-05-scripted-seed42.jsonl`](../../raw/runs/2026-09-05-scripted-seed42.jsonl)
— 1000 ticks, 12 dots, seed 42, `ScriptedPolicy`, 1.40 MB.

## Numbers

| | |
|---|---|
| final state hash | `fdc774c2` |
| events | 12458 |
| marks | 22 alive of 23 created |
| wall clock | 143–150 ms, about **0.15 ms per tick** |
| replay | 1000 ticks, every hash matched |

Speed is worth noting only for what it rules out: at 0.15 ms a tick, nothing in
the engine will be the bottleneck. The budget that matters is model calls, not
CPU — which is exactly what [`0002`](../decisions/0002-sync-ticks-async-reasoning.md)
assumes.

## The bug this run found

**The first version of the run created zero marks.** The scripted policy only
marked where a dot already felt interest, and interest only exists where a mark
already is. Nobody ever laid the first one, so the stigmergic layer — the only
channel between dots — stayed empty forever, and the world was twelve dots
wandering past each other.

Nothing was broken in the engine. The world simply had no way to start. A
bootstrap branch now lets a dot occasionally lay down its favourite topic where
there is nothing at all, and a test holds that line.

Worth keeping in mind for later: a rule that is only ever *reinforced* needs
somewhere to come from. The same shape will reappear when stimuli arrive.

## What is still not verified

Nothing here involves a model. Replay is proven end to end, but with decisions
that were deterministic to begin with. The mechanism is the same one a model
run will use, and that is the point of building it now — but the claim "a run
driven by real models replays exactly" stays unverified until step 7.

## See also

- [`contracts/run-log.md`](../contracts/run-log.md)
- [`concepts/world-state.md`](../concepts/world-state.md) — the energy budget finding
