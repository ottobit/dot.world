/**
 * Public, keyless, CORS-open feeds — the same ones already proven in the
 * portfolio's `script.js`, where their rate limits, timeouts and failure modes
 * were debugged once already. They are not reinvented here.
 *
 * Keyless is a hard requirement, not a preference: the browser build fetches
 * these client-side, and a key there is a key published.
 */
import type { NewsSource, RawItem } from './types.js';

const FETCH_TIMEOUT_MS = 8000;

/**
 * Parses JSON, throws on a non-OK response, and — unlike a bare fetch — gives
 * up instead of hanging forever when a request stalls.
 */
async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), FETCH_TIMEOUT_MS);
  const onAbort = (): void => timeout.abort();
  signal.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { signal: timeout.signal });
    if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

/**
 * Hacker News top stories. Live world and tech news, refreshed continuously,
 * no key, CORS-open.
 */
export function hackerNews(limit = 8): NewsSource {
  return {
    id: 'hackernews',
    intervalMs: 5 * 60_000,
    async fetch(signal): Promise<readonly RawItem[]> {
      const ids = (await fetchJson('https://hacker-news.firebaseio.com/v0/topstories.json', signal) as number[])
        .slice(0, limit);
      const stories = await Promise.all(
        ids.map((id) =>
          fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, signal)
            .catch(() => null) as Promise<{ id: number; title?: string; url?: string } | null>,
        ),
      );
      return stories
        .filter((s): s is { id: number; title: string; url?: string } => !!s?.title)
        .map((s) => ({
          id: `hn-${s.id}`,
          sourceId: 'hackernews',
          title: s.title,
          // A self-post has no external url; its discussion page is the story.
          url: s.url ?? `https://news.ycombinator.com/item?id=${s.id}`,
        }));
    },
  };
}

/**
 * Wikipedia's pageviews-top API: what the world is actually reading. Pageview
 * data lags about two days, so "today" is never ready — going back two days
 * reliably lands on a populated one.
 */
export function wikipediaTrending(lang = 'en', limit = 8): NewsSource {
  return {
    id: 'wikipedia',
    intervalMs: 6 * 60 * 60_000,
    async fetch(signal): Promise<readonly RawItem[]> {
      const d = new Date();
      d.setDate(d.getDate() - 2);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const data = await fetchJson(
        `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${lang}.wikipedia/all-access/${yyyy}/${mm}/${dd}`,
        signal,
      ) as { items?: { articles?: { article: string }[] }[] };
      const articles = data.items?.[0]?.articles ?? [];
      return articles
        .filter((a) => a.article && !/^(Special:|Wikipedia:|Main_Page)/.test(a.article))
        .slice(0, limit)
        .map((a) => ({
          id: `wiki-${a.article}`,
          sourceId: 'wikipedia',
          title: a.article.replace(/_/g, ' '),
          url: `https://${lang}.wikipedia.org/wiki/${a.article}`,
        }));
    },
  };
}

/** The two sources the milestone ships with. */
export function defaultSources(): NewsSource[] {
  return [hackerNews(), wikipediaTrending()];
}
