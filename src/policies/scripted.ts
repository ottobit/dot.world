/**
 * A dot's behaviour with no model involved at all.
 *
 * Not a test double. `ScriptedPolicy` is the fallback when the deliberation
 * budget is exhausted, the policy behind a public demo with no backend, and
 * the reason the whole world can be developed and run offline — decision 0004.
 * Deleting it as "dead code" breaks all three at once, and none of them fail
 * loudly.
 *
 * Deterministic: every draw comes from a seed derived from the dot id and the
 * tick, so the same world replays identically without carrying any state of
 * its own between ticks.
 */
import { createRng, seedToState } from '../core/rng.js';
import type { Intent, Topic } from '../core/types.js';
import type { Decision, DecisionPolicy, DecisionRequest, Personality } from './types.js';

export const TOPICS: readonly Topic[] = ['ai', 'space', 'weather', 'world', 'code', 'trending'];

/** Rest below this share of full energy, whatever else is going on. */
const TIRED = 0.25;
/** Marking costs several moves, so it needs a reason: this much local interest. */
const WORTH_MARKING = 0.35;

/** A cheap, stable string hash, so a seed can be derived from a dot id. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Personalities are derived from the world seed rather than stored, so a run
 * is fully described by that seed plus the dot count.
 */
export function makePersonalities(dotIds: readonly string[], seed: number): Map<string, Personality> {
  const out = new Map<string, Personality>();
  for (const id of dotIds) {
    const rng = createRng(seedToState(seed ^ hashId(id)));
    const interests: Record<Topic, number> = {};
    for (const topic of TOPICS) interests[topic] = Math.round(rng.next() * 100) / 100;
    // One topic is always a clear favourite, otherwise every dot ends up
    // lukewarm about everything and the world reads as undifferentiated.
    const favourite = TOPICS[rng.nextInt(TOPICS.length)];
    if (favourite) interests[favourite] = 1;
    out.set(id, { interests, restlessness: Math.round(rng.next() * 100) / 100 });
  }
  return out;
}

/** The topic a dot cares about most. Ties break on name so it never varies. */
function topInterest(personality: Personality): { topic: Topic; weight: number } | null {
  let best: { topic: Topic; weight: number } | null = null;
  for (const [topic, weight] of Object.entries(personality.interests)) {
    if (best === null || weight > best.weight || (weight === best.weight && topic < best.topic)) {
      best = { topic, weight };
    }
  }
  return best;
}

export function createScriptedPolicy(maxEnergy: number): DecisionPolicy {
  return {
    id: 'scripted',
    decide: (requests: readonly DecisionRequest[]): Promise<readonly Decision[]> =>
      Promise.resolve(requests.map(({ percept, personality }) => decideOne(percept, personality, maxEnergy))),
  };
}

function decideOne(
  percept: DecisionRequest['percept'],
  personality: Personality,
  maxEnergy: number,
): Decision {
  const dotId = percept.self.id;
  const rng = createRng(seedToState(hashId(dotId) ^ (percept.tick * 0x9e3779b1)));
  const intents: Intent[] = [];

  if (percept.self.energy < maxEnergy * TIRED) {
    return { dotId, intents: [{ kind: 'rest', dotId }], rationale: 'low on energy' };
  }

  // How much the strongest nearby topic matters *to this dot*. Salience, not
  // raw strength: two dots standing on the same mark feel it differently.
  const strongest = percept.around[0];
  const interest = strongest ? (personality.interests[strongest.topic] ?? 0) * strongest.strength : 0;

  if (strongest && interest > WORTH_MARKING && rng.next() < 0.3) {
    intents.push({ kind: 'mark', dotId, topic: strongest.topic });
    if (rng.next() < 0.2) intents.push({ kind: 'say', dotId, text: `more ${strongest.topic} here` });
    return { dotId, intents, rationale: `reinforcing ${strongest.topic} (interest ${interest.toFixed(2)})` };
  }

  // Bootstrap. Without this branch the world can never start: a dot only
  // reinforces where it already feels something, and it only feels something
  // where a mark already is, so nobody ever lays the first one and the
  // stigmergic layer stays empty forever. Observed, not theorised — the first
  // 1000-tick run created zero marks.
  if (!strongest) {
    const favourite = topInterest(personality);
    if (favourite && rng.next() < 0.02 * favourite.weight) {
      return {
        dotId,
        intents: [{ kind: 'mark', dotId, topic: favourite.topic }],
        rationale: `laying down ${favourite.topic}, nothing here yet`,
      };
    }
  }

  if (percept.pull && interest > 0.05) {
    const [px, py] = percept.pull.dir;
    intents.push({ kind: 'move', dotId, dx: px * 0.5, dy: py * 0.5 });
    return { dotId, intents, rationale: `following ${percept.pull.topic}` };
  }

  // Nothing worth chasing: wander, or hold still if this dot is the placid sort.
  if (rng.next() > personality.restlessness) {
    return { dotId, intents: [{ kind: 'rest', dotId }], rationale: 'nothing to chase' };
  }
  const angle = rng.nextInt(8);
  // A lookup table rather than Math.cos: trigonometry is not specified to a
  // fixed precision, and a policy feeding a replayable run must be exact.
  const DIRS: readonly (readonly [number, number])[] = [
    [1, 0], [0.71, 0.71], [0, 1], [-0.71, 0.71],
    [-1, 0], [-0.71, -0.71], [0, -1], [0.71, -0.71],
  ];
  const [dx, dy] = DIRS[angle] ?? [1, 0];
  intents.push({ kind: 'move', dotId, dx: dx * 0.5, dy: dy * 0.5 });
  return { dotId, intents, rationale: 'wandering' };
}
