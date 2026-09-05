/**
 * Asks each source on its own schedule and hands the world what is new.
 *
 * Every source is allowed to fail. A feed being rate-limited, blocked or
 * offline must never stop the world — the world simply hears less news for a
 * while, which is a perfectly reasonable thing for a world to do.
 */
import type { ArrivingStimulus } from '../core/step.js';
import type { Enricher, NewsSource, RawItem } from './types.js';

export interface PollerOptions {
  readonly sources: readonly NewsSource[];
  readonly enricher: Enricher;
  /** Injected so tests need no clock and no waiting. */
  readonly now?: () => number;
  readonly onError?: (sourceId: string, error: unknown) => void;
}

export interface Poller {
  /**
   * Fetches from every source whose interval has elapsed, enriches what is new
   * and returns it. Items already seen are dropped, so a feed that repeats
   * itself does not keep re-injecting the same news.
   */
  poll(signal: AbortSignal): Promise<readonly ArrivingStimulus[]>;
  readonly seenCount: number;
}

export function createPoller(options: PollerOptions): Poller {
  const now = options.now ?? Date.now;
  const lastPolled = new Map<string, number>();
  const seen = new Set<string>();

  return {
    get seenCount(): number {
      return seen.size;
    },

    async poll(signal: AbortSignal): Promise<readonly ArrivingStimulus[]> {
      const due = options.sources.filter((s) => now() - (lastPolled.get(s.id) ?? -Infinity) >= s.intervalMs);
      if (due.length === 0) return [];

      const batches = await Promise.all(
        due.map(async (source): Promise<readonly RawItem[]> => {
          try {
            const items = await source.fetch(signal);
            lastPolled.set(source.id, now());
            return items;
          } catch (error) {
            // Counted as polled: a failing source must not be retried on every
            // single tick, which would hammer a rate-limited endpoint.
            lastPolled.set(source.id, now());
            options.onError?.(source.id, error);
            return [];
          }
        }),
      );

      const fresh = batches.flat().filter((item) => !seen.has(item.id));
      if (fresh.length === 0) return [];
      for (const item of fresh) seen.add(item.id);

      const enrichments = await options.enricher.enrich(fresh);
      return fresh.map((item, i) => {
        const e = enrichments[i];
        if (!e) throw new Error(`enricher returned ${enrichments.length} results for ${fresh.length} items`);
        return {
          id: item.id,
          sourceId: item.sourceId,
          title: item.title,
          url: item.url,
          topics: e.topics,
          valence: e.valence,
          intensity: e.intensity,
        };
      });
    },
  };
}
