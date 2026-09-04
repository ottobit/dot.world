import { describe, expect, it } from 'vitest';
import { buildGrid } from '../core/grid.js';
import { buildPercept } from '../core/percept.js';
import { step } from '../core/step.js';
import type { Mark, WorldEvent } from '../core/types.js';
import { createWorld, resolveConfig } from '../core/world.js';
import { createReplayPolicy, ReplayMismatch } from './replay.js';
import { createScriptedPolicy, makePersonalities, TOPICS } from './scripted.js';
import type { Decision } from './types.js';

const config = resolveConfig();

function perceptFor(seed = 1, marks: Mark[] = [], previousEvents: WorldEvent[] = []) {
  const world = { ...createWorld({ seed, dotCount: 3 }), marks };
  const dot = world.dots[0]!;
  const grid = buildGrid(marks, world.width, world.height);
  return { world, dot, percept: buildPercept(world, dot, grid, previousEvents) };
}

describe('percept', () => {
  it('stays well under the 400-token budget', () => {
    const world = createWorld({ seed: 2, dotCount: 12 });
    const marks: Mark[] = TOPICS.map((topic, i) => ({
      id: `m${i}`,
      pos: world.dots[0]!.pos,
      topic,
      strength: 1 + i,
      createdTick: 0,
      byDot: 'dot-000',
    }));
    const grid = buildGrid(marks, world.width, world.height);
    const percept = buildPercept(world, world.dots[0]!, grid, []);
    // Rough but honest: ~4 characters per token. The percept *is* the prompt,
    // so this is a design constraint, not a nicety.
    const approxTokens = JSON.stringify(percept).length / 4;
    expect(approxTokens).toBeLessThan(400);
  });

  it('never exposes a neighbour beyond id, colour, distance and direction', () => {
    // Positions set explicitly rather than seeded: random placement on a 64x36
    // world usually leaves every dot outside the 8-cell vision radius, and the
    // assertion would pass vacuously on an empty neighbour list.
    const base = createWorld({ seed: 3, dotCount: 3 });
    const world = {
      ...base,
      dots: base.dots.map((d, i) => ({ ...d, pos: { x: 10 + i * 2, y: 10 } })),
    };
    const percept = buildPercept(world, world.dots[0]!, buildGrid([], world.width, world.height), []);
    expect(percept.neighbours.length).toBe(2);
    for (const n of percept.neighbours) {
      expect(Object.keys(n).sort()).toEqual(['colour', 'dir', 'dist', 'id']);
    }
  });

  it('reports the previous tick\'s failures so a dot can learn from them', () => {
    const { dot, percept } = perceptFor(4, [], [
      { kind: 'intent-rejected', dotId: 'dot-000', intent: 'move', reason: 'not-enough-energy' },
      { kind: 'intent-rejected', dotId: 'dot-001', intent: 'move', reason: 'not-enough-energy' },
    ]);
    expect(dot.id).toBe('dot-000');
    expect(percept.lastOutcome).toEqual(['move refused: not-enough-energy']);
  });

  it('points the pull toward where the marks actually are', () => {
    const world = createWorld({ seed: 5, dotCount: 1 });
    const dot = world.dots[0]!;
    const cx = Math.floor(dot.pos.x);
    const cy = Math.floor(dot.pos.y);
    const marks: Mark[] = [
      { id: 'm', pos: { x: cx + 1.5, y: cy + 0.5 }, topic: 'ai', strength: 5, createdTick: 0, byDot: 'x' },
    ];
    const percept = buildPercept(world, dot, buildGrid(marks, world.width, world.height), []);
    expect(percept.pull?.topic).toBe('ai');
    expect(percept.pull?.dir[0]).toBeGreaterThan(0); // to the east, where the mark is
  });
});

describe('personalities', () => {
  it('are reproducible from the world seed and give every dot a clear favourite', () => {
    const ids = ['dot-000', 'dot-001', 'dot-002'];
    const a = makePersonalities(ids, 42);
    const b = makePersonalities(ids, 42);
    expect([...a]).toEqual([...b]);
    expect([...a]).not.toEqual([...makePersonalities(ids, 43)]);
    for (const [, p] of a) {
      expect(Math.max(...Object.values(p.interests))).toBe(1);
    }
  });
});

describe('scripted policy', () => {
  const policy = createScriptedPolicy(config.maxEnergy);
  const personality = makePersonalities(['dot-000'], 42).get('dot-000')!;

  it('is deterministic for the same percept and personality', async () => {
    const { percept } = perceptFor(6);
    const [first] = await policy.decide([{ percept, personality }]);
    const [second] = await policy.decide([{ percept, personality }]);
    expect(first).toEqual(second);
  });

  it('rests when it is running out of energy, whatever else is going on', async () => {
    const { percept } = perceptFor(7);
    const tired = { ...percept, self: { ...percept.self, energy: 1 } };
    const [decision] = await policy.decide([{ percept: tired, personality }]);
    expect(decision?.intents).toEqual([{ kind: 'rest', dotId: 'dot-000' }]);
    expect(decision?.rationale).toContain('energy');
  });

  it('bootstraps the world: marks appear from an empty one', async () => {
    // The regression this guards: a dot only reinforces where it already feels
    // something, and only feels something where a mark is. Without a branch
    // that lays the first one, the stigmergic layer stays empty forever — the
    // first 1000-tick run created exactly zero marks.
    let world = createWorld({ seed: 42, dotCount: 12 });
    const people = makePersonalities(world.dots.map((d) => d.id), 42);
    let previous: readonly WorldEvent[] = [];
    for (let i = 0; i < 300 && world.marks.length === 0; i++) {
      const grid = buildGrid(world.marks, world.width, world.height);
      const decisions = await policy.decide(
        world.dots.map((d) => ({ percept: buildPercept(world, d, grid, previous), personality: people.get(d.id)! })),
      );
      const result = step(world, decisions.flatMap((d) => d.intents), config);
      world = result.state;
      previous = result.events;
    }
    expect(world.marks.length).toBeGreaterThan(0);
  });
});

describe('replay policy', () => {
  const percept = perceptFor(8).percept;
  const personality = makePersonalities(['dot-000'], 42).get('dot-000')!;
  const decision: Decision = { dotId: 'dot-000', intents: [], rationale: 'recorded' };

  it('returns exactly what the log recorded for that tick', async () => {
    const p = createReplayPolicy(new Map([[percept.tick, [decision]]]));
    await expect(p.decide([{ percept, personality }])).resolves.toEqual([decision]);
  });

  it('refuses a truncated log rather than pretending every dot did nothing', () => {
    const p = createReplayPolicy(new Map());
    expect(() => p.decide([{ percept, personality }])).toThrow(ReplayMismatch);
  });

  it('refuses a log recorded for a different number of dots', () => {
    const p = createReplayPolicy(new Map([[percept.tick, [decision]]]));
    expect(() => p.decide([
      { percept, personality },
      { percept, personality },
    ])).toThrow(ReplayMismatch);
  });
});
