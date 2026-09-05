import { describe, expect, it, vi } from 'vitest';
import { buildGrid } from '../core/grid.js';
import { buildPercept, type Percept } from '../core/percept.js';
import type { Mark } from '../core/types.js';
import { createWorld, resolveConfig } from '../core/world.js';
import { createEchoModel } from '../models/echo.js';
import type { ChatRequest, LanguageModel } from '../models/types.js';
import { createModelPolicy, latencyPercentiles } from './model.js';
import { buildPrompt, parseDecision } from './prompt.js';
import { createBudgetedPolicy, salience } from './scheduler.js';
import { createScriptedPolicy, makePersonalities } from './scripted.js';
import type { DecisionRequest, Personality } from './types.js';

const config = resolveConfig();
const scripted = createScriptedPolicy(config.maxEnergy);
const personality: Personality = { interests: { ai: 1, space: 0.2 }, restlessness: 0.5 };

/** A dot standing on an `ai` mark to its east, so `pull` has a direction. */
function perceptWithAi(tick = 0): Percept {
  const base = createWorld({ seed: 1, dotCount: 1 });
  const world = { ...base, tick, dots: [{ ...base.dots[0]!, pos: { x: 20, y: 18 } }] };
  const marks: Mark[] = [
    { id: 'm', pos: { x: 21.5, y: 18.5 }, topic: 'ai', strength: 4, createdTick: 0, byDot: 'x' },
  ];
  return buildPercept(world, world.dots[0]!, buildGrid(marks, world.width, world.height), [], config);
}

const req = (percept: Percept = perceptWithAi()): DecisionRequest => ({ percept, personality });

describe('prompt', () => {
  it('sends the percept and only the interests in play', () => {
    const messages = buildPrompt(perceptWithAi(), personality);
    const user = messages[1]!.content;
    expect(user).toContain('"ai"');
    // `space` is a real interest but nothing nearby carries it: re-sending a
    // dot's whole interest vector on every call is paying for zeroes.
    expect(user).not.toContain('space');
    expect(messages[0]!.role).toBe('system');
  });

  it('stays small enough to be worth calling', () => {
    const messages = buildPrompt(perceptWithAi(), personality);
    const approxTokens = messages.map((m) => m.content).join('').length / 4;
    expect(approxTokens).toBeLessThan(400);
  });
});

describe('parsing a reply', () => {
  const percept = perceptWithAi();

  it('accepts a clean decision', () => {
    const r = parseDecision('{"action":"follow","topic":"ai","why":"drawn to ai"}', percept);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.intents[0]).toMatchObject({ kind: 'move', dotId: 'dot-000' });
    expect(r.value.rationale).toBe('drawn to ai');
  });

  it('digs the object out of prose and fences, because small models add both', () => {
    for (const wrapped of [
      'Sure! Here you go:\n```json\n{"action":"mark","topic":"ai","why":"here"}\n```',
      'Thinking... {"action":"mark","topic":"ai","why":"here"} — hope that helps',
    ]) {
      const r = parseDecision(wrapped, percept);
      expect(r.ok, wrapped).toBe(true);
      if (r.ok) expect(r.value.intents[0]).toMatchObject({ kind: 'mark', topic: 'ai' });
    }
  });

  it('takes the first object out of an array, rather than refusing it', () => {
    // A model that wraps one decision in a list is being unhelpful, not wrong.
    const r = parseDecision('[{"action":"rest","why":"ok"}]', percept);
    expect(r.ok).toBe(true);
  });

  it('is not fooled by a brace inside a string', () => {
    const r = parseDecision('{"action":"rest","why":"a } brace"}', percept);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.rationale).toBe('a } brace');
  });

  it('rejects a topic the dot cannot sense', () => {
    // A hallucinated topic is not a decision. Accepting it would let a model
    // invent pressure that is not in the world.
    const r = parseDecision('{"action":"follow","topic":"space","why":"x"}', percept);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure).toBe('unsensed-topic');
  });

  it('names each way a reply can be wrong', () => {
    const cases: [string, string][] = [
      ['not json at all', 'not-json'],
      ['{"action":"follow",}', 'not-json'],
      ['{"action":"levitate"}', 'unknown-action'],
      ['{"action":"mark"}', 'missing-topic'],
    ];
    for (const [text, failure] of cases) {
      const r = parseDecision(text, percept);
      expect(r.ok, text).toBe(false);
      if (!r.ok) expect(r.failure, text).toBe(failure);
    }
  });
});

describe('model policy', () => {
  it('turns an echo reply into an intent', async () => {
    const policy = createModelPolicy({ model: createEchoModel(), fallback: scripted });
    const [decision] = await policy.decide([req()]);
    expect(decision?.dotId).toBe('dot-000');
    expect(decision?.intents.length).toBeGreaterThan(0);
    expect(policy.stats.calls).toBe(1);
    expect(policy.stats.fallbacks).toBe(0);
  });

  it('retries once with the error, then succeeds', async () => {
    const policy = createModelPolicy({
      model: createEchoModel({ replies: ['I would rather not say'] }),
      fallback: scripted,
    });
    const [decision] = await policy.decide([req()]);
    expect(policy.stats.retries).toBe(1);
    expect(policy.stats.calls).toBe(2);
    expect(policy.stats.fallbacks).toBe(0);
    expect(decision?.rationale).not.toContain('fell back');
  });

  it('falls back after two bad replies rather than stopping the world', async () => {
    const policy = createModelPolicy({
      model: createEchoModel({ replies: ['nope', 'still nope'] }),
      fallback: scripted,
    });
    const [decision] = await policy.decide([req()]);
    expect(policy.stats.fallbacks).toBe(1);
    expect(decision?.rationale).toContain('fell back');
    expect(decision?.intents.length).toBeGreaterThan(0);
    expect(policy.stats.failures['not-json']).toBe(2);
  });

  it('falls back when the endpoint itself throws', async () => {
    const dead: LanguageModel = {
      id: 'dead', supportsBatch: false,
      complete: () => Promise.reject(new Error('ECONNREFUSED')),
    };
    const policy = createModelPolicy({ model: dead, fallback: scripted });
    const [decision] = await policy.decide([req()]);
    expect(policy.stats.errors).toBe(1);
    expect(decision?.intents.length).toBeGreaterThan(0);
  });

  it('reports the tail, not an average that hides it', () => {
    expect(latencyPercentiles([])).toEqual({ p50: 0, p95: 0 });
    const l = [10, 10, 10, 10, 10, 10, 10, 10, 10, 900];
    const { p50, p95 } = latencyPercentiles(l);
    expect(p50).toBe(10);
    expect(p95).toBe(900);
  });
});

describe('deliberation budget', () => {
  const many = (n: number, tick = 0): DecisionRequest[] =>
    Array.from({ length: n }, (_, i) => {
      const p = perceptWithAi(tick);
      return { percept: { ...p, self: { ...p.self, id: `dot-${String(i).padStart(3, '0')}` } }, personality };
    });

  it('never exceeds the cap, however many dots ask', async () => {
    // The whole point: cost is a function of wall-clock time, not of N.
    const deliberate = createModelPolicy({ model: createEchoModel(), fallback: scripted });
    const policy = createBudgetedPolicy({ deliberate, fallback: scripted, maxInFlight: 4 });
    const out = await policy.decide(many(40));
    expect(out).toHaveLength(40);
    expect(policy.stats.deliberations).toBe(4);
    expect(policy.stats.missedSlot).toBe(36);
    expect(deliberate.stats.calls).toBe(4);
  });

  it('returns one decision per request, in the caller order', async () => {
    const policy = createBudgetedPolicy({
      deliberate: createModelPolicy({ model: createEchoModel(), fallback: scripted }),
      fallback: scripted, maxInFlight: 3,
    });
    const requests = many(10);
    const out = await policy.decide(requests);
    expect(out.map((d) => d.dotId)).toEqual(requests.map((r) => r.percept.self.id));
  });

  it('does not spend a model call on an exhausted dot', async () => {
    // Measured: as a top-priority trigger this consumed 1014 of 1146
    // deliberations over 300 ticks, to answer a question whose answer is
    // always "rest" and which the scripted layer already knows.
    const deliberate = createModelPolicy({ model: createEchoModel(), fallback: scripted });
    const policy = createBudgetedPolicy({ deliberate, fallback: scripted, maxInFlight: 4 });
    const drained = many(3).map((r): DecisionRequest => ({
      ...r, percept: { ...r.percept, self: { ...r.percept.self, energy: 1 } },
    }));
    const out = await policy.decide(drained);
    expect(deliberate.stats.calls).toBe(0);
    expect(out.every((d) => d.intents[0]?.kind === 'rest')).toBe(true);
  });

  it('gives the slot to a failed action before mere salience', async () => {
    const deliberate = createModelPolicy({ model: createEchoModel(), fallback: scripted });
    const policy = createBudgetedPolicy({ deliberate, fallback: scripted, maxInFlight: 1 });
    const [salient, failed] = many(2);
    const withFailure: DecisionRequest = {
      ...failed!,
      percept: { ...failed!.percept, lastOutcome: ['move refused: not-enough-energy'] },
    };
    await policy.decide([salient!, withFailure]);
    expect(policy.stats.byReason['action-failed']).toBe(1);
    expect(policy.stats.byReason['salient']).toBeUndefined();
  });

  it('wakes a dot that has not thought in a long time', async () => {
    const policy = createBudgetedPolicy({
      deliberate: createModelPolicy({ model: createEchoModel(), fallback: scripted }),
      fallback: scripted, maxInFlight: 4, stalenessTicks: 100, threshold: 99,
    });
    // Nothing is salient enough at this threshold, so only staleness can fire.
    // Staleness is measured from when a dot was first seen, not from the
    // beginning of time: a newborn dot is new, not stale. So the first tick
    // registers it and spends nothing.
    await policy.decide(many(1, 0));
    expect(policy.stats.deliberations).toBe(0);

    await policy.decide(many(1, 99));
    expect(policy.stats.deliberations).toBe(0);

    await policy.decide(many(1, 100));
    expect(policy.stats.byReason['stale']).toBe(1);
  });

  it('spends nothing when nobody has a reason to think', async () => {
    const deliberate = createModelPolicy({ model: createEchoModel(), fallback: scripted });
    const policy = createBudgetedPolicy({
      deliberate, fallback: scripted, threshold: 99, stalenessTicks: 1e9,
    });
    const out = await policy.decide(many(12));
    expect(deliberate.stats.calls).toBe(0);
    expect(policy.stats.belowThreshold).toBe(12);
    expect(out).toHaveLength(12);
  });

  it('breaks ties on dot id, not on array order', async () => {
    // Every dot here has identical salience. Which one gets the single slot
    // must not depend on the order the caller happened to build the array in.
    const run = async (reverse: boolean): Promise<string> => {
      const deliberate = createModelPolicy({ model: createEchoModel(), fallback: scripted });
      const policy = createBudgetedPolicy({ deliberate, fallback: scripted, maxInFlight: 1 });
      const requests = many(3);
      const out = await policy.decide(reverse ? [...requests].reverse() : requests);
      const chosen = out.find((d) => !d.rationale.includes('fell back') && d.rationale === 'drawn to ai');
      return chosen?.dotId ?? 'none';
    };
    expect(await run(false)).toBe('dot-000');
    expect(await run(true)).toBe('dot-000');
  });

  it('scores salience as pressure weighted by what the dot cares about', () => {
    const p = perceptWithAi();
    expect(salience(p, { interests: { ai: 1 }, restlessness: 0 })).toBeGreaterThan(0);
    expect(salience(p, { interests: { ai: 0 }, restlessness: 0 })).toBe(0);
  });
});

describe('transports', () => {
  /**
   * Neither endpoint is reachable from this environment — the egress proxy
   * blocks outbound HTTP and no Ollama runs here. These fixtures pin the
   * documented response shapes so a regression is caught without a network,
   * and nothing here should be read as proof the transports work live.
   */
  it('reads an Ollama chat response', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        message: { content: '{"action":"rest","why":"tired"}' },
        prompt_eval_count: 120, eval_count: 14,
      }),
    }));
    const { createOllamaModel } = await import('../models/http.js');
    const model = createOllamaModel({ model: 'llama3.2' });
    const res = await model.complete(
      { messages: [{ role: 'user', content: 'x' }], json: true, maxTokens: 100, temperature: 0 },
      new AbortController().signal,
    );
    vi.unstubAllGlobals();
    expect(res.text).toContain('rest');
    expect(res.inputTokens).toBe(120);
    expect(res.outputTokens).toBe(14);
  });

  it('reads an OpenAI-compatible response', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '{"action":"wander"}' } }],
        usage: { prompt_tokens: 90, completion_tokens: 8 },
      }),
    }));
    const { createOpenAICompatibleModel } = await import('../models/http.js');
    const model = createOpenAICompatibleModel({ model: 'gpt-x', baseUrl: 'https://example.com/v1' });
    const res = await model.complete(
      { messages: [{ role: 'user', content: 'x' }], json: true, maxTokens: 100, temperature: 0 },
      new AbortController().signal,
    );
    vi.unstubAllGlobals();
    expect(res.text).toContain('wander');
    expect(res.inputTokens).toBe(90);
  });

  it('throws on a non-OK response rather than parsing rubbish', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: false, status: 500, statusText: 'Server Error' }));
    const { createOllamaModel } = await import('../models/http.js');
    const req_: ChatRequest = { messages: [], json: true, maxTokens: 10, temperature: 0 };
    await expect(
      createOllamaModel({ model: 'x' }).complete(req_, new AbortController().signal),
    ).rejects.toThrow(/500/);
    vi.unstubAllGlobals();
  });
});
