import { describe, expect, it, vi } from 'vitest';
import { buildGrid, cellOf, stimulusPressureAt } from '../core/grid.js';
import { hashState } from '../core/hash.js';
import { step, type ArrivingStimulus } from '../core/step.js';
import type { Stimulus, WorldEvent } from '../core/types.js';
import { createWorld, resolveConfig } from '../core/world.js';
import { createKeywordEnricher, enrichOne } from './keyword-enricher.js';
import { createPoller } from './poller.js';
import type { NewsSource, RawItem } from './types.js';

const config = resolveConfig();
const item = (id: string, title: string): RawItem => ({ id, sourceId: 'test', title, url: null });

describe('keyword enricher', () => {
  it('reads topics out of a headline', () => {
    expect(enrichOne(item('a', 'OpenAI releases a new model')).topics).toContain('ai');
    expect(enrichOne(item('b', 'NASA rocket reaches orbit')).topics).toContain('space');
    expect(enrichOne(item('c', 'Storm floods the coast')).topics).toContain('weather');
  });

  it('matches whole words only', () => {
    // The bug every lexicon has for its first week: "ai" firing on "said".
    expect(enrichOne(item('d', 'He said nothing at all')).topics).not.toContain('ai');
    expect(enrichOne(item('e', 'Rustling leaves in the wind')).topics).not.toContain('code');
  });

  it('never drops an item it does not recognise', () => {
    // Unrecognised is still news. Vanishing here would make a world go quiet
    // on an unusual day's headlines.
    expect(enrichOne(item('f', 'Zqx blorp fnord')).topics).toEqual(['trending']);
  });

  it('reads valence from the wording, and stays neutral without it', () => {
    expect(enrichOne(item('g', 'Breakthrough launch wins record')).valence).toBeGreaterThan(0);
    expect(enrichOne(item('h', 'Crash kills, lawsuit and outage')).valence).toBeLessThan(0);
    expect(enrichOne(item('i', 'A quiet afternoon somewhere')).valence).toBe(0);
  });

  it('caps intensity so one headline cannot dominate a world', () => {
    const loud = enrichOne(item('j', 'AI rocket storm war code launch win record breakthrough crash'));
    expect(loud.intensity).toBeLessThanOrEqual(1);
  });

  it('returns one enrichment per item, in order', async () => {
    const items = [item('a', 'AI model'), item('b', 'NASA orbit')];
    const out = await createKeywordEnricher().enrich(items);
    expect(out).toHaveLength(2);
    expect(out[0]!.topics).toContain('ai');
    expect(out[1]!.topics).toContain('space');
  });
});

describe('poller', () => {
  const source = (id: string, intervalMs: number, items: RawItem[]): NewsSource => ({
    id, intervalMs, fetch: () => Promise.resolve(items),
  });

  it('enriches what is new and skips what it has already seen', async () => {
    let clock = 0;
    const poller = createPoller({
      sources: [source('s', 1000, [item('x', 'AI model released')])],
      enricher: createKeywordEnricher(),
      now: () => clock,
    });
    const first = await poller.poll(new AbortController().signal);
    expect(first).toHaveLength(1);
    expect(first[0]!.topics).toContain('ai');

    // Same item, interval elapsed: the feed repeats itself, the world does not.
    clock += 2000;
    expect(await poller.poll(new AbortController().signal)).toHaveLength(0);
    expect(poller.seenCount).toBe(1);
  });

  it('does not ask a source again before its interval has elapsed', async () => {
    let clock = 0;
    const fetch = vi.fn(() => Promise.resolve([item('y', 'NASA orbit')]));
    const poller = createPoller({
      sources: [{ id: 's', intervalMs: 5000, fetch }],
      enricher: createKeywordEnricher(),
      now: () => clock,
    });
    await poller.poll(new AbortController().signal);
    clock += 100;
    await poller.poll(new AbortController().signal);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('survives a source that throws, and does not retry it immediately', async () => {
    // A rate-limited or blocked feed must never stop the world, and must never
    // be hammered on every tick either.
    let clock = 0;
    const errors: string[] = [];
    const failing = vi.fn(() => Promise.reject(new Error('429')));
    const poller = createPoller({
      sources: [
        { id: 'bad', intervalMs: 1000, fetch: failing },
        source('good', 1000, [item('z', 'Storm floods coast')]),
      ],
      enricher: createKeywordEnricher(),
      now: () => clock,
      onError: (id) => errors.push(id),
    });

    const out = await poller.poll(new AbortController().signal);
    expect(out).toHaveLength(1);
    expect(out[0]!.topics).toContain('weather');
    expect(errors).toEqual(['bad']);

    clock += 100;
    await poller.poll(new AbortController().signal);
    expect(failing).toHaveBeenCalledTimes(1);
  });
});

describe('stimuli in the world', () => {
  const arriving = (id: string, topics: string[]): ArrivingStimulus => ({
    id, sourceId: 'test', title: `about ${topics.join(' and ')}`, url: null,
    topics, valence: 0, intensity: 1,
  });

  it('lands a stimulus and reports it', () => {
    const world = createWorld({ seed: 1, dotCount: 2 });
    const { state, events } = step(world, [], config, [arriving('s1', ['ai'])]);
    expect(state.stimuli).toHaveLength(1);
    expect(events).toContainEqual({
      kind: 'stimulus-arrived', stimulusId: 's1', topics: ['ai'], title: 'about ai',
    });
    const landed = state.stimuli[0]!;
    expect(landed.pos.x).toBeGreaterThanOrEqual(0);
    expect(landed.pos.x).toBeLessThan(state.width);
    expect(landed.arrivedTick).toBe(0);
  });

  it('lands it in the same place on a replay of the same seed', () => {
    // Placement is the first rule to draw from the world RNG. If the advanced
    // state were not written back, two runs of one seed would diverge here.
    const a = step(createWorld({ seed: 7, dotCount: 2 }), [], config, [arriving('s', ['ai'])]);
    const b = step(createWorld({ seed: 7, dotCount: 2 }), [], config, [arriving('s', ['ai'])]);
    expect(hashState(a.state)).toBe(hashState(b.state));
    expect(a.state.rngState).not.toBe(createWorld({ seed: 7, dotCount: 2 }).rngState);
  });

  it('is felt as topic pressure that falls off with distance', () => {
    const stim: Stimulus = {
      id: 's', sourceId: 't', title: 'x', url: null, topics: ['ai'],
      valence: 0, intensity: 1, pos: { x: 20.5, y: 10.5 }, arrivedTick: 0,
    };
    const at = (cx: number): number =>
      stimulusPressureAt([stim], cx, 10, config.stimulusRadius).get('ai') ?? 0;
    expect(at(20)).toBeGreaterThan(at(25));
    expect(at(25)).toBeGreaterThan(0);
    expect(at(20 + config.stimulusRadius + 1)).toBe(0);
  });

  it('reaches far enough across the world to be worth reaching', () => {
    // The failure this guards: a radius so small that a stimulus covers a
    // fraction of a percent of the world and no dot ever walks into it. News
    // that nobody can feel is decoration.
    const stim: Stimulus = {
      id: 's', sourceId: 't', title: 'x', url: null, topics: ['ai'],
      valence: 0, intensity: 1, pos: { x: 32.5, y: 18.5 }, arrivedTick: 0,
    };
    let felt = 0;
    for (let cy = 0; cy < config.height; cy++) {
      for (let cx = 0; cx < config.width; cx++) {
        if ((stimulusPressureAt([stim], cx, cy, config.stimulusRadius).get('ai') ?? 0) > 0) felt += 1;
      }
    }
    expect(felt / (config.width * config.height)).toBeGreaterThan(0.1);
  });

  it('fades, and outlasts a mark of the same starting strength', () => {
    // Deliberate: news should outlive the trails it provokes, or a dot can
    // never follow one to its source before it is gone.
    let world = createWorld({ seed: 2, dotCount: 1 });
    world = step(world, [], config, [arriving('s', ['ai'])]).state;
    const dot = world.dots[0]!.id;
    world = step(world, [{ kind: 'mark', dotId: dot, topic: 'ai' }], config).state;

    let markGone = -1;
    let stimGone = -1;
    for (let i = 0; i < 2000 && (markGone < 0 || stimGone < 0); i++) {
      const r = step(world, [], config);
      world = r.state;
      if (markGone < 0 && world.marks.length === 0) markGone = i;
      if (stimGone < 0 && world.stimuli.length === 0) stimGone = i;
    }
    expect(markGone).toBeGreaterThan(-1);
    expect(stimGone).toBeGreaterThan(markGone);
  });

  it('is in the state hash, so two worlds differing only in news differ', () => {
    // The rule from contracts/core-purity: a new WorldState field must reach
    // canonicalise, or the determinism tests pass on a lie.
    const base = createWorld({ seed: 3, dotCount: 1 });
    const quiet = step(base, [], config).state;
    const newsy = step(base, [], config, [arriving('s', ['ai'])]).state;
    expect(hashState(quiet)).not.toBe(hashState(newsy));
  });

  it('places a stimulus where the grid can index it', () => {
    let world = createWorld({ seed: 11, dotCount: 1 });
    for (let i = 0; i < 40; i++) {
      world = step(world, [], config, [arriving(`s${i}`, ['ai'])]).state;
    }
    for (const s of world.stimuli) {
      const { cx, cy } = cellOf(s.pos);
      expect(cx).toBeGreaterThanOrEqual(0);
      expect(cy).toBeGreaterThanOrEqual(0);
      expect(cx).toBeLessThan(world.width);
      expect(cy).toBeLessThan(world.height);
    }
  });
});

describe('source parsing', () => {
  /**
   * The egress proxy in this environment blocks both endpoints (403), so these
   * cannot be checked against the live APIs from here. The response shapes
   * below are the ones `ottobit/portfolio`'s script.js parses — code that has
   * run against these endpoints in production — and the parsing here matches
   * it URL for URL and field for field. These fixtures pin that shape so a
   * regression is caught without a network.
   */
  function stubFetch(routes: Record<string, unknown>): void {
    vi.stubGlobal('fetch', (url: string) => {
      const key = Object.keys(routes).find((k) => url.includes(k));
      if (key === undefined) return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' });
      return Promise.resolve({ ok: true, json: () => Promise.resolve(routes[key]) });
    });
  }

  it('reads Hacker News top stories, falling back to the discussion page', async () => {
    stubFetch({
      'topstories.json': [101, 102],
      'item/101.json': { id: 101, title: 'New AI model released', url: 'https://example.com/a' },
      'item/102.json': { id: 102, title: 'Ask HN: what are you building?' },
    });
    const { hackerNews } = await import('./sources.js');
    const items = await hackerNews().fetch(new AbortController().signal);
    vi.unstubAllGlobals();

    expect(items.map((i) => i.title)).toEqual(['New AI model released', 'Ask HN: what are you building?']);
    expect(items[0]!.url).toBe('https://example.com/a');
    // A self-post has no external url; its discussion page is the story.
    expect(items[1]!.url).toBe('https://news.ycombinator.com/item?id=102');
    expect(items[0]!.sourceId).toBe('hackernews');
  });

  it('reads Wikipedia pageviews and drops the meta pages', async () => {
    stubFetch({
      'pageviews/top': { items: [{ articles: [
        { article: 'Main_Page' }, { article: 'Special:Search' },
        { article: 'Halley%27s_Comet' }, { article: 'Ada_Lovelace' },
      ] }] },
    });
    const { wikipediaTrending } = await import('./sources.js');
    const items = await wikipediaTrending().fetch(new AbortController().signal);
    vi.unstubAllGlobals();

    expect(items.map((i) => i.title)).toEqual(["Halley%27s Comet", 'Ada Lovelace']);
    expect(items[1]!.url).toBe('https://en.wikipedia.org/wiki/Ada_Lovelace');
  });

  it('throws on a non-OK response rather than parsing rubbish', async () => {
    stubFetch({});
    const { hackerNews } = await import('./sources.js');
    await expect(hackerNews().fetch(new AbortController().signal)).rejects.toThrow(/404/);
    vi.unstubAllGlobals();
  });
});

describe('news changes what dots do', () => {
  it('pulls a dot that cares about the topic toward the news', async () => {
    // The payoff of the whole pipeline, and the one thing none of the tests
    // above prove: a headline lands, becomes topic pressure, and a dot whose
    // interests match it moves that way. Without this, news is decoration.
    const { createScriptedPolicy, makePersonalities } = await import('../policies/scripted.js');
    const { advance } = await import('../sim/loop.js');

    let world = createWorld({ seed: 5, dotCount: 1 });
    const id = world.dots[0]!.id;
    // Put the dot somewhere known, and the news squarely to its east.
    world = { ...world, dots: [{ ...world.dots[0]!, pos: { x: 20, y: 18 } }] };
    world = {
      ...world,
      stimuli: [{
        id: 'n', sourceId: 'test', title: 'AI model released', url: null,
        topics: ['ai'], valence: 0, intensity: 1,
        pos: { x: 26.5, y: 18.5 }, arrivedTick: 0,
      }],
    };

    const personalities = new Map([[id, { interests: { ai: 1 }, restlessness: 0 }]]);
    const policy = createScriptedPolicy(config.maxEnergy);

    const startX = world.dots[0]!.pos.x;
    let events: WorldEvent[] = [];
    for (let i = 0; i < 12; i++) {
      const r = await advance(world, policy, personalities, events, config);
      world = r.state;
      events = [...r.events];
    }
    expect(world.dots[0]!.pos.x).toBeGreaterThan(startX);
  });

  it('leaves a dot that does not care where it is', async () => {
    const { createScriptedPolicy } = await import('../policies/scripted.js');
    const { advance } = await import('../sim/loop.js');

    let world = createWorld({ seed: 5, dotCount: 1 });
    const id = world.dots[0]!.id;
    world = { ...world, dots: [{ ...world.dots[0]!, pos: { x: 20, y: 18 } }] };
    world = {
      ...world,
      stimuli: [{
        id: 'n', sourceId: 'test', title: 'AI model released', url: null,
        topics: ['ai'], valence: 0, intensity: 1,
        pos: { x: 26.5, y: 18.5 }, arrivedTick: 0,
      }],
    };
    // Same news, no interest and no restlessness: this dot should sit still.
    const personalities = new Map([[id, { interests: { ai: 0 }, restlessness: 0 }]]);
    const policy = createScriptedPolicy(config.maxEnergy);

    const start = world.dots[0]!.pos;
    for (let i = 0; i < 12; i++) {
      world = (await advance(world, policy, personalities, [], config)).state;
    }
    expect(world.dots[0]!.pos).toEqual(start);
  });
});
