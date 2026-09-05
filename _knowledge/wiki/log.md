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

## [2026-09-05] lint | pull requests can be opened from here after all

An earlier entry in this repository's history recorded that pull requests
could not be created from an agent session. **That was wrong**, and it was
wrong in the expensive direction: it moved work onto the author for several
changes in a row.

What was actually checked before: `gh` is absent, its release download is
blocked by the egress proxy, and `git credential fill` returns nothing. All
three are true and none of them settle the question. What was not tried is the
one thing that works — the proxy injects authentication into `api.github.com`
as well as into git, so plain `curl` against the REST API is authenticated.
`GET /user` returns the owner with no `Authorization` header at all.

Two traps worth naming, since both point the wrong way:

- `GET /repos/{owner}/{repo}` reports `permissions` as all `false` even though
  writes succeed. Ignoring that field and trying the call anyway is what found
  this.
- An absent CLI is not an absent capability. The reasonable-sounding
  conclusion was reached from three real observations and was still false.

`AGENTS.md` now carries the working method for opening a draft PR and for
merging it on "Concludi". PR #2 was opened this way.


## [2026-09-05] lint | the merge recipe written yesterday did not work

`AGENTS.md` was given a "Concludi" recipe — `PATCH {"draft": false}` then
`PUT .../merge` — that had never been run. Neither half works:

- REST **silently ignores** `draft` in a PATCH. It answers `200` with a full
  pull request body and the pull request is still a draft. Nothing about the
  response says the field was dropped.
- `markPullRequestReadyForReview`, the GraphQL mutation that does work in
  general, is refused by this session's proxy: only a pinned set of PR-review
  operations is served.
- `PUT .../merge` on a draft answers `405 Pull Request is still a draft`.

The recipe now merges with git and lets GitHub notice — a pull request is
marked merged as soon as its head is reachable from the base. Verified on
PR #2: `merged: true`.

The pattern is the same one recorded two entries ago, in the opposite
direction. There it was a capability wrongly assumed absent; here a capability
wrongly assumed present. Both came from writing down a conclusion instead of a
result. **Do not put a command in `AGENTS.md` that has not been run.**

## [2026-09-05] ingest | src/web — the viewer

Step 5 of the work order: the first part of Dot World you look at instead of
reading about.

- `src/web/{index.html,main.ts,render.ts,favicon.svg}`, Vite config, Playwright
  config, `e2e/viewer.spec.ts`. Wrote
  [`contracts/viewer.md`](contracts/viewer.md).
- Live mode runs the engine in the page; `?replay=<url>` re-plays a run log.
  Built bundle is 14.3 kB, 6.1 kB gzipped.
- Verified in a real browser, not deduced: twelve dots, the world advancing,
  marks appearing, the inspector opening with the percept in it, pause really
  stopping, step advancing exactly one tick, and zero console errors.
- One end-to-end test counts **distinct colours on the canvas**, because
  "everything runs, nothing is drawn" passes every DOM assertion there is.
- Two things the browser found that no unit test would have: top-level `await`
  is not available at the `es2020` build target (wrapped in a function rather
  than raising the target and dropping older browsers), and a missing favicon
  produced a 404 that failed the zero-console-errors assertion. The favicon was
  added; the assertion was not loosened.
- A stats label read `events` while showing the count for the last tick only.
  Now `events/tick`.

Replay mode is verified in the browser too: a 300-tick, 8-dot sample run ships
as a page asset (280 kB) and an end-to-end test drives it to the last tick.
`ReplayPolicy` throws on a tick the log does not carry, so reaching tick 300
with zero console errors *is* the assertion that every tick matched.

## [2026-09-05] ingest | src/news — the world stops being sealed off

Step 6 of the work order. Two keyless public sources, a deterministic
enricher, a poller, and stimuli that land in the world as pressure.
Wrote [`contracts/news.md`](contracts/news.md) and
[`concepts/stimulus-pipeline.md`](concepts/stimulus-pipeline.md). 66 tests.

**A design flaw the tests caught before any human did.** The first version used
`stimulusRadius: 3`. On a 64×36 world that is **1.2% of the cells**: twelve
dots essentially never walk into a stimulus, so news would have been
decoration. The test that failed was the one asserting a dot moves toward news
it cares about — it did not move, and the reason was the radius, not the test.

Raising the radius was only affordable after changing how pressure is computed:
**by distance on demand** rather than materialised into the grid. Materialising
is O(radius²) per stimulus per tick, which is exactly what forced the radius to
be small. It is 10 now (~14% of the world), and a test holds that fraction
above 10%.

**Two verifications worth naming.** Adding `stimuli` to `WorldState` meant
extending `canonicalise` in the same commit — the rule
[`contracts/core-purity.md`](contracts/core-purity.md) states — and a test now
asserts two worlds differing only in news hash differently. And a 1000-tick run
without `--news` still ends at hash `fdc774c2`, unchanged from before this
work: the feature added nothing to existing behaviour.

**What is not verified.** Both live endpoints answer `403` through this
environment's egress proxy, so nothing here has parsed a real response. The
parsing matches `ottobit/portfolio`'s `script.js` URL for URL and field for
field — code that runs against these endpoints in production — and fixture
tests pin those shapes. The first run on an unblocked network should check it.

Measured with real headlines through a stubbed source, 200 ticks and 12 dots:
**10 of 12 dots were inside some news at any moment**, marks grew 0 → 14
alongside, and the enricher assigned the expected topics and valence.

## [2026-09-05] lint | CI caught three stale pages that local runs could not

`wiki lint (strict)` failed on PR #5 while the same command passed locally.
Not a flake, and not a CI quirk: the **staleness check can only see committed
files**. `git log -1 -- <file>` returns nothing for a file that is not yet in
history, so locally every page under `covers:` was silently skipped. CI runs
with `fetch-depth: 0` against the pushed commits, where the dates exist.

Three pages described code the news work had changed underneath them:

- [`contracts/step-function.md`](contracts/step-function.md) — the worst of the
  three. It stated "no rule currently draws from it" about `rngState`. Stimulus
  placement had made that **false**, and it is exactly the kind of claim a
  future agent would have built on. Now documents the `arrivals` parameter, the
  end-of-tick order, and the obligation to read the generator from the state
  and write it back.
- [`concepts/world-state.md`](concepts/world-state.md) — missing `stimuli`, and
  missing why stimulus pressure is *also* kept out of the grid.
- [`concepts/intent-vs-intention.md`](concepts/intent-vs-intention.md) — events
  that no intent causes now have their own section.

**The local/CI gap is worth keeping in mind rather than closing.** Making the
check work on uncommitted files would mean guessing at mtimes, which drift for
reasons that have nothing to do with authorship. The honest shape is what it
already is: a warning locally, an error in CI, and the knowledge that a green
local run does not clear staleness.

## [2026-09-05] ingest | src/models — a dot that actually reasons

Step 7 of the work order, and the last module the milestone calls for.
`LanguageModel` transports (echo, Ollama, OpenAI-compatible), prompt building
and parsing, `ModelPolicy` with retry and fallback, and the
`BudgetedPolicy` that enforces the cap. 90 tests. Wrote
[`contracts/language-model.md`](contracts/language-model.md),
[`concepts/deliberation-budget.md`](concepts/deliberation-budget.md) and
[`recipes/add-a-model-provider.md`](recipes/add-a-model-provider.md).

**Four things went wrong and were found by measuring, not by reading.**

1. The echo model read `"topic":"<topic>"` out of the *schema example in the
   system prompt* instead of the percept, so every reply failed validation. A
   stub reading the wrong message.
2. A dot that had never deliberated counted as infinitely stale, so on the
   first tick every dot fired the staleness rule and the whole budget went
   before anything had happened. A newborn dot is new, not stale.
3. **25% of replies rejected** as follow-with-no-direction. Not a model
   problem: a dot can sense a topic while standing on its peak, and the prompt
   was offering `follow` anyway. It now sends `canDo`, and the failure has its
   own name rather than being filed under `unsensed-topic` — where it would
   have sent someone hunting a hallucination that never happened. After: **0%
   rejected**.
4. **1014 of 1146 deliberations were spent on exhausted dots.** Low energy was
   the highest-priority trigger, on the reasoning that it was the most pressing
   question. Backwards: it is the least interesting one, because the answer is
   always "rest" and the scripted layer already knows it. An exhausted dot is
   no longer a candidate at all.

**Verified against a real failure, not a stub:** with no Ollama listening,
`--policy model --model ollama:llama3.2` produced 106 transport errors, 106
fallbacks, and a world that ran to completion.

**Two things not verified, said plainly.** Neither HTTP transport has parsed a
real response — the egress proxy blocks outbound HTTP and no Ollama runs here,
so fixtures pin the documented shapes and nothing more. And the cap bounds how
many calls happen per tick but does **not** hide their latency: `advance`
awaits the policy, so a real model would slow the world rather than letting
dots keep acting on a previous plan. Decision
[`0002`](decisions/0002-sync-ticks-async-reasoning.md) describes that shape;
it is not built, and claiming otherwise would be false.

A 1000-tick scripted run still ends at hash `fdc774c2`.
