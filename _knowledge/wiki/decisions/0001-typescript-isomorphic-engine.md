---
id: decisions/0001-typescript-isomorphic-engine
type: decision
title: Why is the engine one TypeScript package that runs in both Node and the browser?
depends_on: [glossary#replay, glossary#run-log]
updated: 2026-09-04
---

# 0001 — TypeScript, one package, isomorphic engine

**When to open this page.** Before adding a Node-only import to `src/core/`,
before proposing a second language, or before splitting the repository.

**Status:** accepted; one supporting claim under revision — see
[Open question](#open-question) below.

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

The repository is staying private, so **GitHub Pages is not available** on a
free plan and the "public demo with no backend" argument above no longer
stands on its own. The isomorphic engine is still justified by the rest — the
viewer runs locally with no backend, and a recorded run replays in a browser —
but the deployment target is undecided. One candidate: publish the viewer
bundle and a recorded run from the public `ottobit/portfolio` repository,
which already serves Pages, while this repository stays private.

Resolve this once the execution model is settled, and rewrite the Decision
section rather than leaving the claim standing.

## See also

- [`0002`](0002-sync-ticks-async-reasoning.md) — the execution model this enables
- [`0004`](0004-two-layer-inference.md) — how providers stay swappable
