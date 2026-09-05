/**
 * Turning a headline into topic pressure, deterministically and for free.
 *
 * The default enricher, and it stays the default even once a model-backed one
 * exists: it is what keeps the browser build and the offline path alive, and a
 * model call here would buy interpretation the world does not need to be
 * interesting. See decision 0005.
 */
import type { Topic } from '../core/types.js';
import type { Enricher, Enrichment, RawItem } from './types.js';

/**
 * A small lexicon, not a classifier. Each entry is matched as a whole word so
 * "ai" does not fire on "said" — the bug that makes every lexicon look clever
 * for a week and useless afterwards.
 */
const LEXICON: Readonly<Record<Topic, readonly string[]>> = {
  ai: ['ai', 'llm', 'model', 'models', 'neural', 'gpt', 'claude', 'openai', 'anthropic', 'machine learning', 'agent', 'agents'],
  space: ['space', 'nasa', 'rocket', 'orbit', 'mars', 'moon', 'satellite', 'telescope', 'astronaut', 'galaxy'],
  weather: ['weather', 'storm', 'hurricane', 'flood', 'drought', 'heatwave', 'climate', 'rain', 'snow'],
  world: ['war', 'election', 'government', 'president', 'protest', 'treaty', 'border', 'summit', 'court'],
  code: ['code', 'software', 'developer', 'developers', 'release', 'open source', 'rust', 'python', 'typescript', 'linux', 'kernel', 'compiler', 'git'],
  trending: [],
};

const POSITIVE = ['launch', 'win', 'wins', 'breakthrough', 'record', 'success', 'improve', 'improved', 'free', 'open', 'new', 'first', 'best', 'growth'];
const NEGATIVE = ['dead', 'dies', 'death', 'crash', 'crisis', 'attack', 'war', 'fail', 'failed', 'failure', 'ban', 'banned', 'lawsuit', 'outage', 'breach', 'loss', 'shut', 'down'];

function words(title: string): Set<string> {
  return new Set(title.toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean));
}

function matches(title: string, terms: readonly string[], tokens: Set<string>): number {
  let hits = 0;
  for (const term of terms) {
    // Multi-word terms need the raw string; single words go through the token
    // set so they only match whole words.
    if (term.includes(' ') ? title.toLowerCase().includes(term) : tokens.has(term)) hits += 1;
  }
  return hits;
}

export function enrichOne(item: RawItem): Enrichment {
  const tokens = words(item.title);
  const topics: Topic[] = [];
  for (const [topic, terms] of Object.entries(LEXICON)) {
    if (terms.length > 0 && matches(item.title, terms, tokens) > 0) topics.push(topic);
  }
  // Nothing recognised is still news: it becomes generic pressure rather than
  // vanishing, so a world with an unusual day's headlines does not go quiet.
  if (topics.length === 0) topics.push('trending');
  topics.sort();

  const positive = matches(item.title, POSITIVE, tokens);
  const negative = matches(item.title, NEGATIVE, tokens);
  const total = positive + negative;
  const valence = total === 0 ? 0 : Math.round(((positive - negative) / total) * 100) / 100;

  // Strongly-worded and clearly-topical items land harder. Capped, because one
  // headline should never dominate a world.
  const intensity = Math.min(1, 0.4 + topics.length * 0.15 + Math.min(total, 3) * 0.08);
  return { topics, valence, intensity: Math.round(intensity * 100) / 100 };
}

export function createKeywordEnricher(): Enricher {
  return {
    id: 'keyword',
    enrich: (items: readonly RawItem[]): Promise<readonly Enrichment[]> =>
      Promise.resolve(items.map(enrichOne)),
  };
}
