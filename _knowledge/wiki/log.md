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
