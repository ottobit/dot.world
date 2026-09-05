/**
 * A dot that actually reasons.
 *
 * Robustness is part of the contract, not a wrapper around it: constrained
 * output, validate, one retry with the error fed back, then fall back to
 * `ScriptedPolicy`. A malformed reply must **never** stop the world — a world
 * that halts because a 3B model emitted a trailing comma is not a world.
 *
 * Every failure is counted and surfaced. "12% invalid JSON with model X" is a
 * number worth seeing, and the only way to have it is to count it here.
 */
import type { LanguageModel } from '../models/types.js';
import { buildPrompt, parseDecision, retryMessage, type ParseFailure } from './prompt.js';
import type { Decision, DecisionPolicy, DecisionRequest } from './types.js';

export interface ModelPolicyStats {
  readonly calls: number;
  readonly retries: number;
  readonly fallbacks: number;
  readonly errors: number;
  readonly failures: Readonly<Record<string, number>>;
  readonly totalMs: number;
  readonly latencies: readonly number[];
}

export interface ModelPolicyOptions {
  readonly model: LanguageModel;
  /** Used when the model fails twice, or throws. Never optional. */
  readonly fallback: DecisionPolicy;
  readonly maxTokens?: number;
  readonly temperature?: number;
}

export interface ModelPolicy extends DecisionPolicy {
  readonly stats: ModelPolicyStats;
}

export function createModelPolicy(options: ModelPolicyOptions): ModelPolicy {
  const failures: Record<string, number> = {};
  const latencies: number[] = [];
  let calls = 0;
  let retries = 0;
  let fallbacks = 0;
  let errors = 0;
  let totalMs = 0;

  const request = { json: true, maxTokens: options.maxTokens ?? 120, temperature: options.temperature ?? 0.7 };

  async function decideOne(req: DecisionRequest, signal: AbortSignal): Promise<Decision> {
    const messages = buildPrompt(req.percept, req.personality);
    const dotId = req.percept.self.id;

    for (let attempt = 0; attempt < 2; attempt++) {
      let reply;
      try {
        calls += 1;
        reply = await options.model.complete({ ...request, messages: [...messages] }, signal);
        totalMs += reply.ms;
        latencies.push(reply.ms);
      } catch (error) {
        // The endpoint being down is not a reason to stop the world either.
        errors += 1;
        failures['transport'] = (failures['transport'] ?? 0) + 1;
        void error;
        break;
      }

      const parsed = parseDecision(reply.text, req.percept);
      if (parsed.ok) {
        return { dotId, intents: parsed.value.intents, rationale: parsed.value.rationale };
      }
      failures[parsed.failure] = (failures[parsed.failure] ?? 0) + 1;
      if (attempt === 0) {
        retries += 1;
        messages.push({ role: 'assistant', content: reply.text }, retryMessage(parsed.failure, parsed.detail));
      }
    }

    fallbacks += 1;
    const [scripted] = await options.fallback.decide([req]);
    if (!scripted) throw new Error('fallback policy returned nothing');
    return { ...scripted, rationale: `${scripted.rationale} (model fell back)` };
  }

  return {
    id: `model:${options.model.id}`,
    get stats(): ModelPolicyStats {
      return { calls, retries, fallbacks, errors, failures: { ...failures }, totalMs, latencies: [...latencies] };
    },
    async decide(requests: readonly DecisionRequest[]): Promise<readonly Decision[]> {
      const signal = new AbortController().signal;
      // Sequential on purpose: concurrency is the scheduler's job, and doing it
      // here as well would make the in-flight cap a lie.
      const out: Decision[] = [];
      for (const req of requests) out.push(await decideOne(req, signal));
      return out;
    },
  };
}

/** p50 / p95, reported honestly rather than as an average that hides the tail. */
export function latencyPercentiles(latencies: readonly number[]): { p50: number; p95: number } {
  if (latencies.length === 0) return { p50: 0, p95: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const at = (q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  return { p50: at(0.5), p95: at(0.95) };
}
