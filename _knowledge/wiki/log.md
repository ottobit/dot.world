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

## [2026-09-04] ingest | src/core

Step 3 of the plan's work order: the engine, with determinism tests written
before anything is visible on screen.

- `src/core/{types,rng,hash,grid,world,step}.ts` and `step.test.ts`.
  28 tests pass; `tsc --noEmit` clean.
- Wrote [`contracts/step-function.md`](contracts/step-function.md),
  [`concepts/world-state.md`](concepts/world-state.md),
  [`concepts/intent-vs-intention.md`](concepts/intent-vs-intention.md) and
  `src/core/AGENTS.md` in the same pass as the code, each carrying `covers:`
  and `exports:`. This is the first time the automated lint has had real files
  to bind to, and it caught index drift on the first run.
- **Deviation from the plan, recorded on the contract page:** the plan sketched
  `step(state, intents, rng)`; the signature takes `config` and leaves the
  generator in `state.rngState`. A live generator passed alongside a state that
  also stores its seed is two sources of truth, and the argument copy would not
  survive serialisation into a run log.

Finding from a 1000-tick run of twelve dots, written up under "The energy
budget is a constraint nobody chose explicitly" in
[`concepts/world-state.md`](concepts/world-state.md): **4172 of 12558 events
were refusals for want of energy.** The engine is correct — it refuses and
says so — but `DEFAULT_CONFIG` implies a rhythm of roughly one rest every six
ticks that nobody chose deliberately. Left untuned on purpose: it should be
tuned against a real policy, not against the test's stand-in, and it interacts
with how often a dot can afford to deliberate.

Open from step 3: nothing writes a run log yet, so `raw/runs/` is still empty
and the replay claim in decision 0002 is unverified end to end.

## [2026-09-05] lint | repository made public

- Verified by anonymous read, not assumed: `git ls-remote` without credentials
  succeeds.
- [`decisions/0001`](decisions/0001-typescript-isomorphic-engine.md): the
  claim flagged as stale on 2026-09-04 is **restored** — GitHub Pages is
  available on a free plan for a public repository. Left as an open question
  rather than closed, because the deployment target was never only a technical
  matter and has not been named.
- New standing rule recorded on that page: everything in `_knowledge/raw/` is
  now world-readable and permanently so. **Do not archive a source you would
  not publish.** Nothing sensitive is in it today.
- Pull request #1 was merged into `main` as a true merge commit (`d2261e3`),
  history preserved. This branch had two commits beyond it and no open pull
  request; rebased onto `main` so the next pull request shows exactly those two.

## [2026-09-05] ingest | src/core/AGENTS.md removed

Per-directory `AGENTS.md` files are gone at the author's request; the coherence
layer stays in one place. Their content was not discarded — the engine's
invariants are now
[`contracts/core-purity.md`](contracts/core-purity.md), which carries `covers:`
across all of `src/core` and is therefore under the automated lint, where the
old file was not.

`AGENTS.md` now forbids adding `AGENTS.md` under `src/`.

## [2026-09-05] ingest | src/policies, src/sim, src/node

Step 4 of the work order: the scripted policy, the headless runner and the run
log, which together close the replay claim.

- `src/core/percept.ts`, `src/policies/{types,scripted,replay}.ts`,
  `src/sim/loop.ts`, `src/node/{runlog,run}.ts`, plus tests. 45 tests pass.
- Wrote [`contracts/decision-policy.md`](contracts/decision-policy.md),
  [`contracts/run-log.md`](contracts/run-log.md) and
  [`concepts/percept.md`](concepts/percept.md).
- **Replay is now verified end to end**, which
  [`0002`](decisions/0002-sync-ticks-async-reasoning.md) claimed and nothing
  had checked: 1000 ticks, every hash matched. Also verified in the other
  direction — a tampered decision at tick 100 is reported at tick 100, and the
  runner exits non-zero.
- Run log carries no events: they are output, regenerated by replay. Dropping
  them cut a 1000-tick log from 2.48 MB to 1.40 MB.

## [2026-09-05] ingest | run 2026-09-05-scripted-seed42

First real run archived, summarised in
[`sources/2026-09-05-first-scripted-run.md`](sources/2026-09-05-first-scripted-run.md).

The run found a real bug before any human did: **the first version created zero
marks.** A dot only marked where it already felt interest, and interest only
exists where a mark already is, so nobody laid the first one and the stigmergic
layer stayed empty forever. Fixed with a bootstrap branch, guarded by a test.

Still unverified: nothing here involves a model, so "a run driven by real
models replays exactly" waits for step 7.
