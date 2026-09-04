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
  read, saved design conversations, snapshots of the portfolio references.
  Read them. **Never edit or delete a file in `raw/`.**
- `_knowledge/wiki/` — **the wiki.** You write and maintain every page here.
- `_knowledge/lint/` — the automated half of Lint (`wiki.test.ts`).

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

Directories under `src/` carry their own `AGENTS.md` with local invariants.
The nearest one wins. They stay next to the code on purpose — their value is
proximity. They point into the wiki; they never duplicate it.

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
- Verify before claiming something is done: `npm test`, `npx tsc --noEmit`,
  and Playwright when there is UI. Report results honestly, failures included.
- No step is finished until the wiki has absorbed it (Ingest) and `log.md`
  has the line.
- Language: **the wiki and all code comments are in English.** Conversations
  with the user are in Italian.
