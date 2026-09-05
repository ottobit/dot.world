---
id: contracts/news
type: contract
title: How does a headline become something a dot can feel?
covers: [src/news/types.ts, src/news/sources.ts, src/news/keyword-enricher.ts, src/news/poller.ts]
exports: [NewsSource, RawItem, Enricher, Enrichment, hackerNews, wikipediaTrending, defaultSources, createKeywordEnricher, enrichOne, createPoller]
depends_on: [decisions/0005-enrich-news-once, concepts/stimulus-pipeline]
updated: 2026-09-05
---

# Contract — news ingestion

**When to open this page.** Before adding a source, changing the enricher, or
putting a headline anywhere near a dot.

```
RawItem --[Enricher, once per batch]--> ArrivingStimulus --> World --> topic pressure
```

## Rules

1. **Keyless, CORS-open sources only.** The browser build fetches these
   client-side; a key there is a key published.
2. **The enricher runs once per batch, never per dot.** Per-dot enrichment
   multiplies cost by N and produces N inconsistent readings of one fact.
3. **Every source may fail.** A blocked, rate-limited or offline feed means the
   world hears less news for a while. It is never a reason to stop, and a
   failing source is marked polled so it is not hammered every tick.
4. **Items already seen are dropped.** A feed that repeats itself does not
   re-inject the same news.
5. **A dot never receives the title.** The world holds it for the viewer and
   the log; a dot feels topic pressure. See
   [`0005`](../decisions/0005-enrich-news-once.md).

## The two sources

`hackerNews()` every 5 minutes and `wikipediaTrending()` every 6 hours — the
same endpoints, response shapes and fallbacks that `ottobit/portfolio`'s
`script.js` already runs in production.

**Unverified against the live endpoints from this environment:** the egress
proxy answers `403` for both. The parsing matches the portfolio's, URL for URL
and field for field, and fixture tests pin those shapes — but nobody has yet
seen this code parse a real response. The first run on an unblocked network
should check it.

## What NOT to do

- **Do not add a source that needs a key or a signup.** See rule 1.
- **Do not let a source failure propagate.** The poller catches, reports and
  carries on.
- **Do not enrich per dot.** If a dot should read a fact differently, that
  belongs in its `interests`, not in a second enrichment.
- **Do not drop an item the lexicon does not recognise.** It becomes
  `trending` pressure. Dropping it makes a world go quiet on an unusual day.
- **Do not match lexicon terms as substrings.** `ai` inside `said` is the bug
  every lexicon has for its first week; single words go through a token set.

## See also

- [`concepts/stimulus-pipeline.md`](../concepts/stimulus-pipeline.md)
