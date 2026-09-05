---
id: findings/portfolio-handoff
type: finding
title: What should the portfolio page say about Dot World, and what must it not claim?
sources: [_knowledge/raw/portfolio/dot-world-diagram.svg, _knowledge/raw/runs/2026-09-05-scripted-seed42.jsonl]
depends_on: [decisions/0002-sync-ticks-async-reasoning, decisions/0003-engine-owns-state, decisions/0005-enrich-news-once, concepts/deliberation-budget]
updated: 2026-09-05
---

# Handing this project to the portfolio

**When to open this page.** You are writing or updating
`ottobit/portfolio`'s `dot-world.html`. This is the whole handover; nothing
about it lives in a chat transcript.

This repository is **public**. Clone it and read
[`../index.md`](../index.md) first, then [`../log.md`](../log.md) for what
happened and [`../decisions/`](../decisions/) for why. Everything below is
extracted from those, with sources named.

---

## 1. The published diagram was wrong. It has been redrawn

Three things on it were contradicted by the code, deliberately, and it omitted
the marks entirely. Each one, and what replaced it, is in
**[`diagram-corrections.md`](diagram-corrections.md)**. Shipped 2026-09-05 in
`ottobit/portfolio#136`, along with the page itself.

## 2. The material worth writing about

"A multi-agent simulation with pluggable LLM inference" is what everyone
writes. What this project actually has is a record of things that were wrong
and how they were found. Each of these is measured, sourced, and in the log:

| finding | number |
|---|---|
| the first full run created **zero marks** — a dot only reinforced where it already felt something, and only felt something where a mark already was, so nobody ever laid the first one | 1000 ticks, 12 dots |
| the news radius covered **1.2% of the world**, so twelve dots essentially never walked into a stimulus — news was decoration | 64×36 grid, radius 3 |
| **25% of model replies rejected**, and it was a prompt bug: the prompt offered `follow` to a dot standing on the peak, where there is nowhere to follow | echo run, 300 ticks |
| **1014 of 1146 deliberations** spent on exhausted dots, because "low energy" was made the top-priority trigger — the least interesting question, since the answer is always "rest" | 300 ticks, 12 dots |
| a wiki page claimed "no rule draws from `rngState`" after stimulus placement had made it false — **caught by CI, not by a person** | staleness check |
| a merge recipe was written into `AGENTS.md` **without ever being run**, and neither half of it worked | REST silently ignores `draft` |

The engine runs a thousand ticks in about 150 ms, which is worth one sentence
only for what it rules out: the engine is never the bottleneck, so the only
budget that matters is model calls.

**The strongest single artifact is the viewer running in the page.** It is a
static bundle with no backend: either live with the scripted policy, or
`?replay=<url>` against a recorded run. `vite.config.ts` already uses
`base: './'` so it serves from a subdirectory.

---

## 3. Do not duplicate this wiki

The portfolio page is a **front door**, not a second copy. A page that repeats
the contracts will be false within two commits, and there is no lint watching
it — which is precisely the failure mode this repository was built to avoid.
One fact, one place; link to the rest.

---

## 4. What the page must not claim

- **No real model has ever driven this world.** The transports exist, are
  tested against fixtures, and fall back correctly — verified against a real
  failure: with no Ollama listening, 106 transport errors, 106 fallbacks, and
  a world that ran to completion. But neither HTTP transport has parsed a live
  response, because this repository's development environment blocks outbound
  HTTP.
- **Model latency is not hidden.** The deliberation cap bounds how many calls
  happen per tick; `advance` still awaits the policy, so a real model would
  slow the world rather than letting dots keep acting on a previous plan. The
  shape that fixes it — `mind: idle | thinking | committed` — is described in
  decision 0002 and is **not built**.
- **The news feeds have never been read from here.** Both endpoints answer
  `403` through the egress proxy. The parsing matches `script.js` URL for URL,
  and fixtures pin the shapes; nobody has seen it parse a real response.

Saying these plainly is worth more than hiding them. A portfolio page that
distinguishes what is verified from what is merely built is doing the thing
the project is about.

**The published page now says all three**, in its "Where it stands" section,
in the same voice and at the same weight as the numbers that went well. When
one of them stops being true — the first live model call, the first parsed
feed — that section is what has to change, and this page with it.

---

## 5. If you are an agent picking this up

Nothing here was handed to you in a conversation. Clone the repo, read
[`../index.md`](../index.md), then:

```sh
grep "^## \[" _knowledge/wiki/log.md | tail -10   # what happened recently
npm install && npm run dev                        # the viewer, live
npm run world -- --ticks 1000 --seed 42 --dots 12 # a headless run
```

The scripted 1000-tick run at seed 42 ends at hash `fdc774c2`. If it does not,
something changed and the wiki is behind.

## See also

- [`../index.md`](../index.md) — every page in this wiki
- [`../decisions/`](../decisions/) — the five decisions and their "What NOT to do"
