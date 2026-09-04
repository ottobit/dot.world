---
id: decisions/0005-enrich-news-once
type: decision
title: Why is a news item enriched once for everyone instead of read by each dot?
depends_on: [glossary#enricher, glossary#stimulus, glossary#salience]
updated: 2026-09-04
---

# 0005 — Enrich news once, share it with every dot

**When to open this page.** Before putting a headline into a dot's prompt, or
before adding a per-dot news call.

**Status:** accepted.

## Context

The world reads real news from public, keyless, CORS-open feeds — the same six
already proven in the portfolio's `script.js`: Hacker News, Hugging Face,
Wikipedia pageviews, Open-Meteo, NASA APOD, GitHub commits. They are already
debugged for rate limits, timeouts and fallbacks; they are not reinvented.

The naive design hands raw headlines to every dot and lets each interpret
them. That multiplies interpretation cost by N and produces N inconsistent
readings of the same fact.

## Decision

```
RawItem --[Enricher]--> Stimulus { id, topics[], valence, intensity } --> World
```

Two enricher implementations:

- **`KeywordEnricher`** — deterministic. A topic lexicon (`ai`, `space`,
  `weather`, `conflict`, `money`, `code`, `nature`, …) and a small valence
  word list. Free, instant, runs in the browser. **Default.**
- **`ModelEnricher`** — one model call **per batch of ~8 items**, never per
  dot. News arrives at roughly ten items every five minutes and serves every
  dot, so amortised cost is near zero. This is the cheap place to spend a
  model call.

**A stimulus enters the world as weather, not as a message.** It lands in a
region with an intensity that diffuses and decays. A dot perceives *topic
pressure* in its own cell — it does not read a headline, it feels that there
is a lot of `ai` over there.

Each dot has `interests: Record<topic, weight>`.
[Salience](../glossary.md#salience) is
`dot(interests, stimulus.topics) * intensity` — **and that is exactly the
deliberation trigger** from [`0002`](0002-sync-ticks-async-reasoning.md). The
two are one mechanism, not two.

## Consequences

- News cost is per-batch, not per-dot-per-item.
- Every dot shares one consistent reading of a fact and differs in how much it
  *cares*, which is the interesting axis.
- Stimuli fit the percept budget: a topic id and an intensity, not prose.

## What NOT to do

- **Do not put raw headline text in a dot's prompt.** It blows the ~400-token
  [percept](../glossary.md#percept) budget and reintroduces per-dot
  interpretation cost.
- **Do not call an enricher per dot.** If a dot needs a different reading, that
  belongs in its `interests`, not in a second enrichment.
- **Do not add a news source that needs an API key or a signup.** The browser
  build fetches these client-side; a key there is a key published.
- **Do not drop `KeywordEnricher` once `ModelEnricher` works.** It is what
  keeps the browser build and the offline path alive.

## See also

- [`0004`](0004-two-layer-inference.md) — the other place a model is spent
- [`glossary#stimulus`](../glossary.md#stimulus)
