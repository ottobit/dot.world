# Log

Append-only, oldest first. Fixed prefix so it stays greppable:

```
grep "^## \[" _knowledge/wiki/log.md | tail -5
```

Entry kinds: `ingest`, `query`, `lint`.

---

## [2026-09-04] ingest | project bootstrap

Repository created from an approved plan. No code yet.

- Seeded `_knowledge/raw/portfolio/` with `dot-world-diagram.svg` and
  `dot-world.html` from `ottobit/portfolio` — the sketch this project starts
  from, and the source the five decisions below argue with.
- Wrote `AGENTS.md` (schema, page conventions, Ingest/Query/Lint) and
  `CLAUDE.md` (pointer).
- Wrote `glossary.md`. Terms fixed now because several pairs collide by
  nature: `intent` vs `intention`, `mark` vs `stimulus`, `reasoning` vs
  `deliberation`.
- Wrote decisions 0001–0005. These are the only category knowable before
  code exists, and the one that stops a later agent from undoing a deliberate
  choice.
- Wrote `_knowledge/lint/wiki.test.ts` — the automated half of Lint. It exists
  from the first page, never bolted on later.

Open contradiction, deliberately recorded rather than resolved: the source
diagram in `raw/portfolio/` shows `Reason → Decide` inside the per-tick loop
and `Act` writing to shared state. Decisions
[`0002`](decisions/0002-sync-ticks-async-reasoning.md) and
[`0003`](decisions/0003-engine-owns-state.md) both contradict it. The diagram
is labelled "still taking shape" and is kept as-is: it is an immutable source,
not a specification. It should be redrawn on the portfolio once code confirms
the design.

## [2026-09-04] lint | 1 stale claim

The repository will stay private and execution will work differently (exact
model still to be defined by the user).

- [`decisions/0001`](decisions/0001-typescript-isomorphic-engine.md) argued
  the isomorphic engine partly from a public GitHub Pages demo. Pages is not
  available on a free plan for a private repository, so that supporting claim
  no longer holds. Flagged on the page as an open question rather than
  rewritten — the replacement depends on a decision not yet taken.
- Not caught by `_knowledge/lint/wiki.test.ts`, and correctly so: no link is
  broken and no symbol is missing. The page simply became less true. This is
  the first real case of the LLM half of Lint earning its place.

## [2026-09-04] ingest | plan 2026-09-04-initial-plan

First plan ingested under the new rule in `AGENTS.md`: an approved plan is
archived verbatim in `raw/plans/`, and only what is knowable without code is
written to the wiki.

- Archived [`raw/plans/2026-09-04-initial-plan.md`](../raw/plans/2026-09-04-initial-plan.md)
  (546 lines, Italian, verbatim — a source records what was written, it is not
  kept current).
- Wrote [`sources/2026-09-04-initial-plan.md`](sources/2026-09-04-initial-plan.md).
- Added the plan to the `sources:` front-matter of decisions 0001-0005: they
  came from it, and nothing recorded that.
- Wrote nothing under `contracts/` or `concepts/`. The plan describes code that
  does not exist; such a page would read as documentation, be verified by
  nothing, and be invisible to the automated lint for want of a `covers:`
  target.

Two proposals in the plan remain unacted on and are named on the source page:
the three corrections to the published diagram (different repository), and a
dot's memory modelled as a wiki of its own (deferred to real numbers).
