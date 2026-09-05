/**
 * Building the prompt, and reading the answer back.
 *
 * This lives in the policy layer, not in a `LanguageModel` — decision 0004. The
 * moment two transports word the same request differently, comparing them
 * measures the prompts rather than the models.
 */
import type { Intent } from '../core/types.js';
import type { Percept } from '../core/percept.js';
import type { ChatMessage } from '../models/types.js';
import type { Personality } from './types.js';

/**
 * Deliberately terse. The percept is already the expensive part of the prompt,
 * and every token spent here is spent again on every deliberation of every dot.
 */
const SYSTEM = [
  'You are one dot in a world of dots. You cannot talk to the others.',
  'You only sense topic pressure around you: marks other dots left, and news that landed nearby.',
  'Reply with ONE JSON object and nothing else:',
  '{"action":"follow"|"mark"|"rest"|"wander","topic":"<topic>","why":"<at most 8 words>"}',
  '"topic" is required for follow and mark, and must be one you can sense.',
  'Only use an action listed in "canDo".',
].join('\n');

export function buildPrompt(percept: Percept, personality: Personality): ChatMessage[] {
  // Interests are trimmed to what is actually in play. A dot's full interest
  // vector is mostly zeroes it cannot act on, and it would be re-sent on every
  // single call.
  const relevant: Record<string, number> = {};
  for (const { topic } of percept.around) {
    const weight = personality.interests[topic];
    if (weight !== undefined) relevant[topic] = weight;
  }
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: JSON.stringify({
        you: percept.self,
        sensing: percept.around,
        pull: percept.pull,
        others: percept.neighbours.length,
        lastOutcome: percept.lastOutcome,
        youCareAbout: relevant,
        // Offering `follow` with nothing to follow toward is a prompt bug, not
        // a model error: measured at 25% of replies rejected before this was
        // here, every one of them recovered by a retry that cost a second call.
        canDo: percept.pull ? ['follow', 'mark', 'rest', 'wander'] : ['mark', 'rest', 'wander'],
      }),
    },
  ];
}

export type ParseFailure =
  | 'not-json'
  | 'not-an-object'
  | 'unknown-action'
  | 'missing-topic'
  | 'unsensed-topic'
  /** Sensed, but the dot is already at the peak: there is nowhere to follow it. */
  | 'no-direction';

export interface ParsedDecision {
  readonly intents: readonly Intent[];
  readonly rationale: string;
}

export type ParseResult =
  | { readonly ok: true; readonly value: ParsedDecision }
  | { readonly ok: false; readonly failure: ParseFailure; readonly detail: string };

/**
 * Pulls the first balanced `{...}` out of a reply. Small models routinely wrap
 * JSON in prose or a fenced block even when asked not to, and refusing those
 * outright would throw away answers that are perfectly good.
 */
function extractObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

const ACTIONS = new Set(['follow', 'mark', 'rest', 'wander']);
const STEP = 0.5;

export function parseDecision(text: string, percept: Percept): ParseResult {
  const raw = extractObject(text);
  if (raw === null) return { ok: false, failure: 'not-json', detail: 'no JSON object in the reply' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { ok: false, failure: 'not-json', detail: String(error) };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, failure: 'not-an-object', detail: raw.slice(0, 80) };
  }

  const { action, topic, why } = parsed as { action?: unknown; topic?: unknown; why?: unknown };
  if (typeof action !== 'string' || !ACTIONS.has(action)) {
    return { ok: false, failure: 'unknown-action', detail: String(action) };
  }
  const rationale = typeof why === 'string' && why.length > 0 ? why.slice(0, 60) : action;
  const dotId = percept.self.id;

  if (action === 'rest') return { ok: true, value: { intents: [{ kind: 'rest', dotId }], rationale } };
  if (action === 'wander') {
    // No direction of its own: wandering is the absence of a reason, and the
    // engine clamps whatever comes out anyway.
    const [dx, dy] = percept.pull?.dir ?? [1, 0];
    return { ok: true, value: { intents: [{ kind: 'move', dotId, dx: -dx * STEP, dy: -dy * STEP }], rationale } };
  }

  if (typeof topic !== 'string' || topic.length === 0) {
    return { ok: false, failure: 'missing-topic', detail: `${action} without a topic` };
  }
  // A topic the dot cannot sense is a hallucination, not a decision. Accepting
  // it would let a model invent pressure that is not in the world.
  if (!percept.around.some((a) => a.topic === topic)) {
    return { ok: false, failure: 'unsensed-topic', detail: topic };
  }

  if (action === 'mark') return { ok: true, value: { intents: [{ kind: 'mark', dotId, topic }], rationale } };

  const dir = percept.pull?.topic === topic ? percept.pull.dir : null;
  // Its own failure name rather than being folded into `unsensed-topic`: the
  // topic is real, the direction is not, and a statistic that conflates the
  // two would send someone hunting a hallucination that never happened.
  if (!dir) return { ok: false, failure: 'no-direction', detail: `${topic} is here, not over there` };
  return { ok: true, value: { intents: [{ kind: 'move', dotId, dx: dir[0] * STEP, dy: dir[1] * STEP }], rationale } };
}

/** The nudge sent on the single retry, so the model is told what was wrong. */
export function retryMessage(failure: ParseFailure, detail: string): ChatMessage {
  return {
    role: 'user',
    content: `That was rejected (${failure}: ${detail}). Reply with ONE JSON object matching the schema, and nothing else.`,
  };
}
