---
id: decisions/0001-typescript-isomorphic-engine
type: decision
title: Why is the engine one TypeScript package that runs in both Node and the browser?
depends_on: [glossary#replay, glossary#run-log]
sources: [_knowledge/raw/plans/2026-09-04-initial-plan.md]
updated: 2026-09-04
---

# 0001 — TypeScript, one package, isomorphic engine

**When to open this page.** Before adding a Node-only import to `src/core/`,
before proposing a second language, or before splitting the repository.

**Status:** accepted. One supporting claim was invalidated and then restored —
see [Open question](#open-question) below.

## Context

Dot World needs two things that pull in opposite directions:

- **Real inference.** A page served over HTTPS from `github.io` cannot call
  `http://localhost:11434` — the browser blocks it as mixed content. And an
  API key shipped inside a static page is a key given away. Real inference
  therefore must be able to run outside the browser.
- **Being watched.** `dot` exists to be looked at. A portfolio project that
  only ever appears in a terminal is half a project.

## Decision

One TypeScript npm package. `src/core/` is **pure**: no Node built-ins, no
I/O, no `fetch`. The same engine therefore runs headless under Node with real
providers, and inside a browser page with `ScriptedPolicy`.

Vite builds the web bundle. Vitest runs the tests. No UI framework — the
canvas is drawn by hand, as `dot` already is on the portfolio.

## Consequences

- The public page gets a live simulation with no backend and no keys.
- A run driven by real models is recorded to a [run log](../glossary.md#run-log)
  and [replayed](../glossary.md#replay) in the same web viewer. The public
  demo can therefore show real model behaviour without exposing anything.
- `src/core/` cannot read files, fetch, or look at the clock. Everything it
  needs is passed in. That constraint is what keeps it testable.

## What NOT to do

- **Do not import `node:fs`, `node:path`, `process`, or call `fetch` from
  `src/core/`.** It compiles fine and then fails only in the browser bundle,
  usually at runtime, usually on the deployed page. I/O belongs in
  `src/node/` or `src/news/`.
- **Do not rewrite the simulation in Python** because it "feels like a
  simulation language". Inference here is an HTTP call, not training; there
  is no ML library to reach for. A second language would mean the scripted
  policy exists twice, and the two copies would diverge.
- **Do not split this into a monorepo** before there is a second consumer.
  The tax is real and the benefit is currently zero.

## Open question

**Update, same day: the repository is public.** Anonymous reads succeed, so
GitHub Pages is available on a free plan again and the constraint that
invalidated this argument is gone. The earlier note — that Pages was
unavailable on a private repository — is superseded.

The question is not fully closed, because the deployment target was never only
a matter of what is technically possible: the author separately said execution
would work differently, and did not say how. The isomorphic engine stands on
its own either way — the viewer runs locally with no backend, and a recorded
run replays in a browser — so nothing in the Decision section depends on the
answer.

Close this by naming the target once it is decided: Pages on this repository,
the viewer published from the public `ottobit/portfolio` repository, or local
only.

**Consequence of being public, worth knowing before it bites:**
everything under `_knowledge/raw/` is now world-readable, permanently, and
forks and caches do not retract. That directory is meant to hold saved design
conversations and run logs carrying raw model responses. Nothing sensitive is
in it today — portfolio snapshots and the initial plan — but the rule to apply
from here on is: **do not archive a source you would not publish.**

## See also

- [`0002`](0002-sync-ticks-async-reasoning.md) — the execution model this enables
- [`0004`](0004-two-layer-inference.md) — how providers stay swappable
