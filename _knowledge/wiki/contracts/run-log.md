---
id: contracts/run-log
type: contract
title: What is in a run log, and what makes a replay trustworthy?
covers: [src/node/runlog.ts, src/node/run.ts]
exports: [RunLogHeader, RunLogTick, RunLogLine, RUN_LOG_VERSION, createRunLog, readRunLog, runFresh, runReplay, parseArgs, main]
depends_on: [decisions/0002-sync-ticks-async-reasoning, contracts/decision-policy]
updated: 2026-09-05
---

# Contract — the run log

**When to open this page.** Before changing the log format, or before trusting
a "replay OK".

JSONL, append-only. Node-only: this is the I/O boundary, and nothing under
`src/core` or `src/sim` may import it.

## Shape

**Header line** — everything needed to rebuild the world from nothing: version,
seed, dot count, policy id, the full config, and the hash of the world before
any tick. A log therefore never depends on the flags someone happened to pass
alongside it.

**One line per tick** — tick number, the decisions taken, and the resulting
state hash.

**No events.** Events are *output*: replaying the decisions regenerates them
exactly, so storing them is redundant. Dropping them cut a 1000-tick log from
2.48 MB to 1.40 MB.

## Why replay is the point

Models are not deterministic. The *record of what they answered* is. Replay
feeds the recorded decisions back through `ReplayPolicy`, so a run driven by
real models reproduces exactly — the claim
[`0002`](../decisions/0002-sync-ticks-async-reasoning.md) rests on.

It was built while the only policy was scripted and the whole thing was
verifiable end to end. Waiting for models would have meant debugging the replay
mechanism and the model at the same time.

## What makes it trustworthy

- **The hash is compared at every tick, not only at the end.** A divergence at
  tick 3 is a bug you can find; one at tick 1000 is an afternoon.
- **The initial hash is checked before the first tick**, so a log whose seed no
  longer rebuilds the world it claims fails immediately.
- **The version is checked**, so a log from a future build is refused rather
  than misread.
- **A tampered log is detected at the tick it was changed.** Verified: altering
  one dot's decision at tick 100 reports the divergence at 100.

## What NOT to do

- **Do not treat "replay OK" as proof without a negative check.** A replay that
  can only ever say OK proves nothing. There is a test that tampers with a log
  and requires the divergence to be found.
- **Do not add derived data to the log.** If replay can regenerate it, storing
  it is a second source of truth that can disagree.
- **Do not archive every run.** Logs are megabytes. Archive one under
  `_knowledge/raw/runs/` when it teaches something.

## See also

- [`contracts/decision-policy.md`](decision-policy.md)
- [`sources/2026-09-05-first-scripted-run.md`](../sources/2026-09-05-first-scripted-run.md)
