import { describe, expect, it } from 'vitest';
import { buildGrid, cellOf, strongestTopic } from './grid.js';
import { hashState } from './hash.js';
import { createRng, seedToState } from './rng.js';
import { orderIntents, step } from './step.js';
import type { Intent, WorldConfig, WorldEvent, WorldState } from './types.js';
import { createWorld, resolveConfig } from './world.js';

const config: WorldConfig = resolveConfig();

/**
 * A scripted intent generator standing in for a policy: deterministic, and
 * varied enough that a thousand ticks exercise movement, clamping, marking,
 * reinforcement, energy exhaustion and decay rather than one code path.
 */
function intentsFor(state: WorldState): Intent[] {
  const rng = createRng(seedToState(state.tick));
  const out: Intent[] = [];
  for (const dot of state.dots) {
    const roll = rng.next();
    if (roll < 0.1) out.push({ kind: 'rest', dotId: dot.id });
    else if (roll < 0.2) out.push({ kind: 'mark', dotId: dot.id, topic: roll < 0.15 ? 'ai' : 'space' });
    else out.push({ kind: 'move', dotId: dot.id, dx: (rng.next() - 0.5) * 3, dy: (rng.next() - 0.5) * 3 });
    if (roll > 0.97) out.push({ kind: 'say', dotId: dot.id, text: 'hello' });
  }
  return out;
}

function run(seed: number, ticks: number): { state: WorldState; events: WorldEvent[] } {
  let state = createWorld({ seed, dotCount: 12 });
  const events: WorldEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(state, intentsFor(state), config);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

describe('determinism', () => {
  it('produces an identical state hash after 1000 ticks from the same seed', () => {
    const a = run(42, 1000);
    const b = run(42, 1000);
    expect(a.state.tick).toBe(1000);
    expect(hashState(a.state)).toBe(hashState(b.state));
    expect(a.events.length).toBe(b.events.length);
  });

  it('produces a different state from a different seed', () => {
    // Guards against a hash so lossy that everything collides, which would
    // make the test above pass for the wrong reason.
    expect(hashState(run(42, 200).state)).not.toBe(hashState(run(43, 200).state));
  });

  it('exercises every rule over those 1000 ticks', () => {
    // A determinism test over a run that only ever moves would prove very
    // little. This asserts the run actually reaches the interesting branches.
    const events = run(42, 1000).events;
    const kinds = new Set(events.map((e) => e.kind));
    for (const expected of ['moved', 'move-clamped', 'marked', 'rested', 'said', 'mark-faded', 'intent-rejected']) {
      expect(kinds, `no ${expected} event in 1000 ticks`).toContain(expected);
    }
    // The stand-in rests one tick in ten while the energy budget needs closer
    // to one in six, so dots run themselves down and the run covers both the
    // healthy and the exhausted regime. Asserted rather than left implicit:
    // if a config change made energy free, this run would quietly stop
    // exercising rejection and the coverage claim above would go hollow.
    const rejected = events.filter((e) => e.kind === 'intent-rejected');
    expect(rejected.filter((e) => e.reason === 'not-enough-energy').length).toBeGreaterThan(100);
    expect(events.filter((e) => e.kind === 'moved').length).toBeGreaterThan(100);
  });

  it('leaves the input state untouched', () => {
    const before = createWorld({ seed: 7, dotCount: 4 });
    const snapshot = hashState(before);
    step(before, intentsFor(before), config);
    expect(hashState(before)).toBe(snapshot);
  });
});

describe('intent ordering', () => {
  it('orders by kind, then by dot id, never by arrival', () => {
    const arrived: Intent[] = [
      { kind: 'say', dotId: 'dot-002', text: 'c' },
      { kind: 'move', dotId: 'dot-002', dx: 1, dy: 0 },
      { kind: 'rest', dotId: 'dot-009' },
      { kind: 'move', dotId: 'dot-001', dx: 1, dy: 0 },
    ];
    expect(orderIntents(arrived).map((i) => `${i.kind}:${i.dotId}`)).toEqual([
      'rest:dot-009',
      'move:dot-001',
      'move:dot-002',
      'say:dot-002',
    ]);
    // Shuffling the input must not change the output.
    expect(orderIntents([...arrived].reverse())).toEqual(orderIntents(arrived));
  });

  it('rejects a second intent of the same kind from the same dot', () => {
    const world = createWorld({ seed: 1, dotCount: 1 });
    const id = world.dots[0]!.id;
    const { events } = step(
      world,
      [
        { kind: 'move', dotId: id, dx: 0.1, dy: 0 },
        { kind: 'move', dotId: id, dx: -5, dy: 0 },
      ],
      config,
    );
    expect(events.filter((e) => e.kind === 'intent-rejected')).toHaveLength(1);
    expect(events).toContainEqual({ kind: 'intent-rejected', dotId: id, intent: 'move', reason: 'duplicate-intent' });
  });

  it('rejects an intent from a dot that does not exist', () => {
    const world = createWorld({ seed: 1, dotCount: 1 });
    const { events, state } = step(world, [{ kind: 'rest', dotId: 'ghost' }], config);
    expect(events).toContainEqual({ kind: 'intent-rejected', dotId: 'ghost', intent: 'rest', reason: 'unknown-dot' });
    expect(state.dots).toHaveLength(1);
  });
});

describe('movement', () => {
  it('clamps to the speed limit without refusing the move', () => {
    const world = createWorld({ seed: 3, dotCount: 1 });
    const dot = world.dots[0]!;
    const { state, events } = step(world, [{ kind: 'move', dotId: dot.id, dx: 50, dy: 0 }], config);
    const moved = state.dots[0]!;
    const travelled = Math.sqrt(
      (moved.pos.x - dot.pos.x) ** 2 + (moved.pos.y - dot.pos.y) ** 2,
    );
    expect(travelled).toBeLessThanOrEqual(config.maxSpeed + 1e-9);
    expect(events.some((e) => e.kind === 'move-clamped')).toBe(true);
  });

  it('keeps every dot inside the world across a long run', () => {
    for (const dot of run(11, 500).state.dots) {
      expect(dot.pos.x).toBeGreaterThanOrEqual(0);
      expect(dot.pos.y).toBeGreaterThanOrEqual(0);
      expect(dot.pos.x).toBeLessThan(config.width);
      expect(dot.pos.y).toBeLessThan(config.height);
      // The grid must be able to index wherever a dot can stand.
      const { cx, cy } = cellOf(dot.pos);
      expect(cx).toBeLessThan(config.width);
      expect(cy).toBeLessThan(config.height);
    }
  });

  it('refuses to move a dot with no energy left', () => {
    const world = createWorld({ seed: 5, dotCount: 1 });
    const id = world.dots[0]!.id;
    const drained: WorldState = { ...world, dots: [{ ...world.dots[0]!, energy: 0 }] };
    const { events, state } = step(drained, [{ kind: 'move', dotId: id, dx: 1, dy: 0 }], config);
    expect(events).toContainEqual({ kind: 'intent-rejected', dotId: id, intent: 'move', reason: 'not-enough-energy' });
    expect(state.dots[0]!.pos).toEqual(drained.dots[0]!.pos);
  });
});

describe('marks', () => {
  const still = (state: WorldState): WorldState => state;

  it('reinforces an existing mark of the same topic instead of duplicating it', () => {
    let world = createWorld({ seed: 9, dotCount: 1 });
    const id = world.dots[0]!.id;
    world = still(step(world, [{ kind: 'mark', dotId: id, topic: 'ai' }], config).state);
    expect(world.marks).toHaveLength(1);

    const first = world.marks[0]!.strength;
    const second = step(world, [{ kind: 'mark', dotId: id, topic: 'ai' }], config);
    expect(second.state.marks).toHaveLength(1);
    expect(second.state.marks[0]!.strength).toBeGreaterThan(first);
    expect(second.events).toContainEqual({
      kind: 'marked', dotId: id, markId: world.marks[0]!.id, reinforced: true,
    });
  });

  it('does not merge marks of different topics in the same place', () => {
    let world = createWorld({ seed: 9, dotCount: 1 });
    const id = world.dots[0]!.id;
    world = step(world, [{ kind: 'mark', dotId: id, topic: 'ai' }], config).state;
    world = step(world, [{ kind: 'mark', dotId: id, topic: 'space' }], config).state;
    expect(world.marks.map((m) => m.topic).sort()).toEqual(['ai', 'space']);
  });

  it('decays a mark until it fades, and reports the fade', () => {
    let world = createWorld({ seed: 9, dotCount: 1 });
    const id = world.dots[0]!.id;
    world = step(world, [{ kind: 'mark', dotId: id, topic: 'ai' }], config).state;

    let faded = false;
    for (let i = 0; i < 500 && !faded; i++) {
      const result = step(world, [], config);
      world = result.state;
      faded = result.events.some((e) => e.kind === 'mark-faded');
    }
    expect(faded).toBe(true);
    expect(world.marks).toHaveLength(0);
  });

  it('rejects a mark with an empty topic', () => {
    const world = createWorld({ seed: 9, dotCount: 1 });
    const id = world.dots[0]!.id;
    const { events, state } = step(world, [{ kind: 'mark', dotId: id, topic: '' }], config);
    expect(events).toContainEqual({ kind: 'intent-rejected', dotId: id, intent: 'mark', reason: 'empty-topic' });
    expect(state.marks).toHaveLength(0);
  });
});

describe('speech', () => {
  it('clears a saying once its duration has passed', () => {
    let world = createWorld({ seed: 4, dotCount: 1 });
    const id = world.dots[0]!.id;
    world = step(world, [{ kind: 'say', dotId: id, text: 'hi' }], config).state;
    expect(world.dots[0]!.saying).toBe('hi');

    for (let i = 0; i <= config.sayDurationTicks; i++) world = step(world, [], config).state;
    expect(world.dots[0]!.saying).toBeNull();
  });
});

describe('grid', () => {
  it('aggregates mark strength per topic and reads out of bounds as empty', () => {
    const grid = buildGrid(
      [
        { id: 'm0', pos: { x: 2.2, y: 3.9 }, topic: 'ai', strength: 1, createdTick: 0, byDot: 'd' },
        { id: 'm1', pos: { x: 2.8, y: 3.1 }, topic: 'ai', strength: 2, createdTick: 0, byDot: 'd' },
        { id: 'm2', pos: { x: 2.5, y: 3.5 }, topic: 'space', strength: 5, createdTick: 0, byDot: 'd' },
      ],
      config.width,
      config.height,
    );
    expect(grid.at(2, 3).get('ai')).toBe(3);
    expect(grid.at(2, 3).get('space')).toBe(5);
    expect(grid.at(-1, 0).size).toBe(0);
    expect(grid.at(config.width, 0).size).toBe(0);
    expect(strongestTopic(grid.neighbourhood(3, 4))).toEqual({ topic: 'space', strength: 5 });
    expect(strongestTopic(new Map())).toBeNull();
  });

  it('breaks ties on topic name, not on map ordering', () => {
    expect(strongestTopic(new Map([['space', 1], ['ai', 1]]))).toEqual({ topic: 'ai', strength: 1 });
    expect(strongestTopic(new Map([['ai', 1], ['space', 1]]))).toEqual({ topic: 'ai', strength: 1 });
  });
});

describe('rng', () => {
  it('is reproducible from a seed and resumable from its state', () => {
    const a = createRng(seedToState(123));
    const first = [a.next(), a.next(), a.next()];

    const resumed = createRng(a.state());
    const b = createRng(seedToState(123));
    b.next(); b.next(); b.next();
    expect(resumed.next()).toBe(b.next());
    expect(createRng(seedToState(123)).next()).toBe(first[0]);
  });

  it('stays inside [0, 1) and spreads across the range', () => {
    const rng = createRng(seedToState(1));
    const buckets = new Array(10).fill(0) as number[];
    for (let i = 0; i < 10000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      buckets[Math.floor(v * 10)] = (buckets[Math.floor(v * 10)] ?? 0) + 1;
    }
    for (const count of buckets) expect(count).toBeGreaterThan(700);
  });
});
