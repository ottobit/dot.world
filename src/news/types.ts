/**
 * News ingestion. The world is not sealed off: what the dots feel is shaped by
 * things that actually happened.
 *
 * The pipeline is `RawItem --[Enricher]--> ArrivingStimulus --> World`, and the
 * enricher runs **once per batch, shared by every dot** — never per dot. See
 * decision 0005.
 */
import type { Topic } from '../core/types.js';

/** Straight from a feed, before anyone has decided what it means. */
export interface RawItem {
  readonly id: string;
  readonly sourceId: string;
  readonly title: string;
  readonly url: string | null;
}

export interface NewsSource {
  readonly id: string;
  /** How long to wait before asking this source again. */
  readonly intervalMs: number;
  fetch(signal: AbortSignal): Promise<readonly RawItem[]>;
}

export interface Enrichment {
  readonly topics: readonly Topic[];
  /** -1 grim, +1 bright. */
  readonly valence: number;
  readonly intensity: number;
}

export interface Enricher {
  readonly id: string;
  /** Takes the whole batch: enriching per dot would multiply cost by N. */
  enrich(items: readonly RawItem[]): Promise<readonly Enrichment[]>;
}
