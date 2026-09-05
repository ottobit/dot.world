/**
 * A model that answers without a model.
 *
 * Not a mock in the usual sense: it lets the whole model *path* — prompt
 * building, JSON parsing, validation, retry, fallback, the deliberation budget
 * — be developed and tested with no endpoint, no key and no network. Every
 * failure mode a real model has can be provoked here on demand, which is the
 * only way to test them reliably: a real model produces bad JSON when it feels
 * like it, not when a test needs it.
 */
import type { ChatRequest, ChatResponse, LanguageModel } from './types.js';

export interface EchoOptions {
  /** Forced replies, consumed in order. Use to provoke malformed output. */
  readonly replies?: readonly string[];
  /** Milliseconds to report. Not slept — tests should not wait. */
  readonly ms?: number;
}

/**
 * Reads the dot id and the strongest topic back out of the prompt and answers
 * with a plausible, schema-valid decision, so a run against it looks like a run
 * against a small model that happens to behave.
 */
export function createEchoModel(options: EchoOptions = {}): LanguageModel {
  const queued = [...(options.replies ?? [])];
  return {
    id: 'echo',
    supportsBatch: false,
    complete(request: ChatRequest): Promise<ChatResponse> {
      const forced = queued.shift();
      // The *last user* message, not the whole prompt. Reading the lot means
      // matching the schema example in the system message — which yielded a
      // literal "<topic>" and made every echo reply fail validation.
      const prompt = [...request.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
      const dotId = /"id":\s*"([^"]+)"/.exec(prompt)?.[1] ?? 'dot-000';
      const topic = /"sensing":\[\{"topic":\s*"([^"]+)"/.exec(prompt)?.[1] ?? null;
      // Honours `canDo`. A stub that ignored it would answer `follow` where
      // there is nothing to follow, and the resulting rejection rate would read
      // as a model-quality signal when it is only a stub being careless.
      const canFollow = /"canDo":\[[^\]]*"follow"/.test(prompt);
      const text = forced ?? JSON.stringify(
        topic
          ? canFollow
            ? { action: 'follow', topic, why: `drawn to ${topic}` }
            : { action: 'mark', topic, why: `${topic} is strongest right here` }
          : { action: 'wander', why: 'nothing to feel here' },
      );
      return Promise.resolve({
        text, model: 'echo', inputTokens: prompt.length >> 2, outputTokens: text.length >> 2,
        ms: options.ms ?? 0,
      });
    },
  };
}
