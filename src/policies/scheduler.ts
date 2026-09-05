/**
 * The deliberation budget — the lever that makes cost independent of N.
 *
 * Most of what a dot does is code. A deliberation is a rare event that replaces
 * its plan, and at most `maxInFlight` of them happen per tick. Candidates are
 * ranked by salience; whoever misses a slot falls back to `ScriptedPolicy` and
 * carries on, which is why `ScriptedPolicy` is not a test double.
 *
 * Cost therefore scales with wall-clock time, not with the number of dots.
 * Adding dots adds contention for slots, which degrades gracefully into
 * scripted behaviour rather than into a larger bill. See decision 0002.
 */
import type { DotId } from '../core/types.js';
import type { Decision, DecisionPolicy, DecisionRequest, Personality } from './types.js';
import type { Percept } from '../core/percept.js';

export interface SchedulerOptions {
  readonly deliberate: DecisionPolicy;
  readonly fallback: DecisionPolicy;
  /** Hard cap on deliberations per tick. The lever that bounds cost. */
  readonly maxInFlight?: number;
  /** A dot deliberates at least this often regardless of salience. */
  readonly stalenessTicks?: number;
  /** Below this salience a dot is not a candidate at all. */
  readonly threshold?: number;
}

export interface SchedulerStats {
  readonly deliberations: number;
  readonly missedSlot: number;
  readonly belowThreshold: number;
  readonly byReason: Readonly<Record<string, number>>;
}

export interface BudgetedPolicy extends DecisionPolicy {
  readonly stats: SchedulerStats;
}

/**
 * How much a dot should want to think right now.
 *
 * Deliberately the same quantity as the salience of news to a dot — pressure it
 * can feel, weighted by how much it cares. The two were never separate
 * mechanisms; treating them as one is what keeps news and thinking connected.
 */
export function salience(percept: Percept, personality: Personality): number {
  let best = 0;
  for (const { topic, strength } of percept.around) {
    best = Math.max(best, (personality.interests[topic] ?? 0) * strength);
  }
  return best;
}

type Reason = 'salient' | 'stale' | 'action-failed';

export function createBudgetedPolicy(options: SchedulerOptions): BudgetedPolicy {
  const maxInFlight = options.maxInFlight ?? 4;
  const stalenessTicks = options.stalenessTicks ?? 240;
  const threshold = options.threshold ?? 0.2;
  const lastDeliberated = new Map<DotId, number>();

  let deliberations = 0;
  let missedSlot = 0;
  let belowThreshold = 0;
  const byReason: Record<string, number> = {};

  function reasonFor(req: DecisionRequest, maxEnergy: number): { reason: Reason; score: number } | null {
    const { percept, personality } = req;
    // A dot seen for the first time is not stale — it is new. Defaulting to
    // -Infinity made every dot fire the staleness rule on its first tick,
    // which spent the whole budget before anything had happened.
    const first = lastDeliberated.get(percept.self.id);
    if (first === undefined) lastDeliberated.set(percept.self.id, percept.tick);
    const since = percept.tick - (first ?? percept.tick);
    // An exhausted dot is not a candidate at all. It was one, at the highest
    // priority, on the reasoning that it had the most pressing question —
    // which is backwards: it has the least interesting one, because the answer
    // is always "rest" and the scripted layer already knows it. Measured over
    // 300 ticks with twelve dots: 1014 of 1146 deliberations were spent on it.
    if (percept.self.energy < maxEnergy * 0.15) return null;
    if (percept.lastOutcome.length > 0) return { reason: 'action-failed', score: 1e5 };
    if (since >= stalenessTicks) return { reason: 'stale', score: 1e4 };
    const s = salience(percept, personality);
    return s >= threshold ? { reason: 'salient', score: s } : null;
  }

  return {
    id: `budgeted:${options.deliberate.id}`,
    get stats(): SchedulerStats {
      return { deliberations, missedSlot, belowThreshold, byReason: { ...byReason } };
    },

    async decide(requests: readonly DecisionRequest[]): Promise<readonly Decision[]> {
      // 100 is the world's default max energy; the scheduler only needs the
      // ratio, and threading the whole config in for one constant is noise.
      const maxEnergy = 100;
      const candidates: { index: number; score: number; reason: Reason }[] = [];
      for (const [index, req] of requests.entries()) {
        const verdict = reasonFor(req, maxEnergy);
        if (verdict === null) {
          belowThreshold += 1;
          continue;
        }
        candidates.push({ index, ...verdict });
      }

      candidates.sort((a, b) =>
        // Ties break on dot id, so which dot gets the last slot never depends
        // on array order.
        b.score === a.score
          ? (requests[a.index]!.percept.self.id < requests[b.index]!.percept.self.id ? -1 : 1)
          : b.score - a.score,
      );
      const chosen = candidates.slice(0, maxInFlight);
      missedSlot += candidates.length - chosen.length;

      const chosenIndices = new Set(chosen.map((c) => c.index));
      const deliberated = chosen.length > 0
        ? await options.deliberate.decide(chosen.map((c) => requests[c.index]!))
        : [];
      const scriptedFor = requests.filter((_, i) => !chosenIndices.has(i));
      const scripted = scriptedFor.length > 0 ? await options.fallback.decide(scriptedFor) : [];

      for (const c of chosen) {
        deliberations += 1;
        byReason[c.reason] = (byReason[c.reason] ?? 0) + 1;
        lastDeliberated.set(requests[c.index]!.percept.self.id, requests[c.index]!.percept.tick);
      }

      // Reassembled in the caller's order: a policy must return one decision
      // per request, in the same order, whatever it did internally.
      const out: Decision[] = new Array(requests.length) as Decision[];
      chosen.forEach((c, i) => { out[c.index] = deliberated[i]!; });
      let s = 0;
      for (let i = 0; i < requests.length; i++) if (!chosenIndices.has(i)) out[i] = scripted[s++]!;
      return out;
    },
  };
}
