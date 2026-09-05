# AGENTS.md — how to work in this repository

Dot World is a simulated world populated by many autonomous `dot`s. Each dot
perceives, reasons with its own model (local or remote), decides, and acts.
Dots never talk to each other: they influence one another only through the
shared world state.

This file is the **schema**. It tells you how the repository is organised and
which workflow to follow. It is a map, not the territory — keep it short and
put the content in the wiki.

## The two layers

| layer | path | who owns it | mutable? |
|---|---|---|---|
| **code** | `src/`, config files | humans + agents, via PRs | yes |
| **coherence** | `_knowledge/` | the LLM writes it, the human reads it | see below |

Inside `_knowledge/`:

- `_knowledge/raw/` — **immutable sources.** Run logs, benchmark output, articles
  read, approved plans (`raw/plans/`), saved design conversations, snapshots of
  the portfolio references. Read them.
  **Never edit or delete a file in `raw/`.** A source is a record of what was
  written at a moment, not a document to keep current — including when it was
  written in Italian and the wiki is in English, and including when a later
  decision contradicts it. Contradictions get annotated in the wiki, never
  fixed at the source.
- `_knowledge/wiki/` — **the wiki.** You write and maintain every page here.
- `_knowledge/lint/` — the automated half of Lint (`wiki.test.ts`).

Everything outside `_knowledge/` is code. **Do not add `AGENTS.md` files under
`src/`** — the coherence layer stays in one place.

Source code is deliberately **not** in `raw/`: it changes on every commit and
it is already the truth — read it directly rather than summarising it. `raw/`
holds what the code does not contain and cannot be re-derived.

## Where to look

Start at **[`_knowledge/wiki/index.md`](_knowledge/wiki/index.md)** — it catalogues
every page with a one-line summary. Read the index first, then open only the
pages you need.

- **What happened recently?** → `_knowledge/wiki/log.md`
  (`grep "^## \[" _knowledge/wiki/log.md | tail -5`)
- **What does this word mean?** → `_knowledge/wiki/glossary.md`
- **Why is it built this way? Why not the obvious alternative?**
  → `_knowledge/wiki/decisions/` — read these **before** proposing a redesign.
- **What is the contract of X?** → `_knowledge/wiki/contracts/`
- **How do I add a news source / an action / a model provider?**
  → `_knowledge/wiki/recipes/`
- **We already answered that** → `_knowledge/wiki/findings/`

Local invariants for a module live in the wiki, not beside the code: for the
engine, [`contracts/core-purity.md`](_knowledge/wiki/contracts/core-purity.md).

## Page conventions

Every wiki page (except `index.md` and `log.md`) starts with YAML front-matter:

```yaml
---
id: concepts/marks-stigmergy          # matches the path, without .md
type: concept | decision | contract | recipe | source | finding
title: What a mark is, and why dots never talk to each other
covers: [src/core/marks.ts]           # code files this page describes (optional)
exports: [Mark, applyMark]            # symbols that must exist in `covers` (optional)
sources: [_knowledge/raw/reading/foo.md] # sources this page draws on (optional)
depends_on: [concepts/world-state]    # other pages, or glossary#term
updated: 2026-09-04
---
```

Rules:

- **One page answers one question, and the title *is* the question.**
- Max ~120 lines. If a page grows past that, split it and link the halves.
- **No duplication.** A fact lives on exactly one page; everywhere else links
  to it. Duplicated facts drift apart.
- Open with **"When to open this page"** (two lines). This is routing
  information for an agent, not a courtesy to a human.
- Close with **"See also"**.
- `decisions/` pages must include a **"What NOT to do"** section listing the
  rejected alternatives and the concrete consequence of trying them again.
- Links are relative markdown paths, and they are checked by the test.
- Set `updated:` whenever you change a page.

## The three workflows

### Ingest — a new source arrives in `_knowledge/raw/`

1. Read the source in full.
2. Discuss the key points with the human before writing.
3. Write `_knowledge/wiki/sources/<id>.md` summarising it.
4. **Update every wiki page the source touches.** This is the real work — one
   source often touches 10–15 pages.
5. If the source contradicts an existing page, **annotate the contradiction;
   do not silently resolve it.** Say which claim is older and which source
   supports each side.
6. Update `index.md`. Append to `log.md`.

### Ingest — an approved plan

A plan the user approved is a source like any other, with one difference that
matters: **it describes code that does not exist yet.** Split it in two.

**On approval:**

1. Copy the plan verbatim to `_knowledge/raw/plans/<YYYY-MM-DD>-<slug>.md`.
   Verbatim: it is the record of what was agreed, not a draft to improve.
2. Write `_knowledge/wiki/sources/<same-slug>.md` summarising it.
3. Write or update only what is **knowable without code**: `decisions/` pages,
   the glossary, and any existing page the plan changes. Add the plan to those
   pages' `sources:`.
4. Update `index.md`. Append `## [date] ingest | plan <slug>` to `log.md`.

**With the code, not before:** `contracts/` and `concepts/` pages ship in the
same pull request as the module they describe, carrying `covers:` and
`exports:` so the automated lint binds them to files that actually exist.

**Do not write a `contracts/` or `concepts/` page from a plan alone.** It reads
as documentation and is a wish. Nothing verifies it, the automated lint cannot
see it — there is no `covers:` target to compare against — and it will be false
within two commits. The damage is not the wrong page; it is that the wiki has
taught the reader it can be trusted.

Development follows the plan's own work order, and each step closes with its
own Ingest.

### Query — a question is asked of the wiki

1. Read `index.md`, then open the pages that look relevant.
2. Answer **with citations to wiki pages**, not from memory.
3. If the answer is worth keeping, file it as `_knowledge/wiki/findings/<slug>.md`,
   link it from the related pages, update `index.md`, append to `log.md`.
   A good answer that stays in chat is a loss.

### Lint — periodic health check

Run `npm run lint:wiki` first: it catches everything mechanically decidable
(broken links, `covers:` matching nothing, `exports:` that no longer exist,
orphans, index drift, staleness). Then do the half a test cannot do:

- contradictions between pages
- claims a newer source has superseded
- concepts referenced everywhere but with no page of their own
- missing cross-references
- gaps worth a new source or a web search

Lint **reports**; it does not rewrite pages on its own. Append its findings to
`log.md` as a `lint` entry.

## Log format

Append-only, newest at the bottom, fixed prefix so it stays greppable:

```
## [2026-09-04] ingest | run-2026-09-04-ollama-llama32
## [2026-09-04] query  | why small models fail structured output
## [2026-09-04] lint   | 3 stale pages, 1 orphan
```

## Working conventions

- Work on a dedicated branch. Descriptive commits. Open the PR **as a draft**.
- **Never merge on your own initiative** — that decision is the user's alone.
  The exception is work born from a plan the user approved via ExitPlanMode.
- **Opening and merging the pull request is the agent's job, not the user's.**
  `gh` is not installed and `git credential fill` returns nothing, but the
  session's proxy injects authentication into `api.github.com` as well as into
  git — so plain `curl` against the REST API is already authenticated. Do not
  send the user a compare link and do not ask them to open anything.

  ```sh
  # open, always as a draft
  curl -sS -X POST -H "Accept: application/vnd.github+json" \
    --data @body.json https://api.github.com/repos/ottobit/dot.world/pulls
  # body.json: {"title":..., "head":"<branch>", "base":"main", "draft":true, "body":...}
  ```

  `GET /repos/{owner}/{repo}` reports `permissions` as all `false` even though
  writes succeed. **Ignore that field** — it made an earlier session conclude,
  wrongly, that pull requests could not be created at all. Try the call.

- **The PR stays a draft until the user says "Concludi"** (or "commit push PR",
  or an explicit instruction to merge). That word means: mark it ready for
  review, merge it, and confirm. Nothing else authorises a merge — not green
  tests, not a finished task.

  **A draft cannot be merged through the API, and it cannot be undrafted from
  here either.** REST silently ignores `draft` in a PATCH (it answers `200`
  and the pull request stays a draft), and the GraphQL mutation that would do
  it, `markPullRequestReadyForReview`, is refused by this session's proxy —
  only a pinned set of PR-review operations is served. `PUT .../merge` on a
  draft answers `405 Pull Request is still a draft`.

  So merge with git and let GitHub notice. A pull request is marked merged as
  soon as its head becomes reachable from the base:

  ```sh
  git checkout main && git pull --ff-only origin main
  git merge --no-ff <branch> -m "Merge pull request #N from ottobit/<branch>"
  # verify ON main before pushing — tsc, WIKI_STRICT=1 npm test, and a replay
  git push origin main
  ```

  Then confirm with `GET .../pulls/N` that it reports `merged: true`, delete
  the merged branch, and unsubscribe from its activity.

  The one standing exception is work born from a plan the user approved via
  ExitPlanMode: that approval already authorises the merge.

- Verify before claiming something is done: `npm test`, `npx tsc --noEmit`,
  and Playwright when there is UI. Report results honestly, failures included.
- No step is finished until the wiki has absorbed it (Ingest) and `log.md`
  has the line.
- Language: **the wiki and all code comments are in English.** Conversations
  with the user are in Italian.
