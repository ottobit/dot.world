/**
 * Replays decisions recorded in a run log instead of producing new ones.
 *
 * This is what makes a run driven by real models reproducible. The models are
 * not deterministic; the *record* of what they answered is. Replay feeds those
 * answers back in order, so the world reproduces exactly — see decision 0002.
 *
 * Built now, while the only policy is scripted and the whole thing is
 * verifiable end to end. Waiting until models are involved would mean debugging
 * the replay mechanism and the model at the same time.
 */
import type { Decision, DecisionPolicy, DecisionRequest } from './types.js';

export class ReplayMismatch extends Error {}

/**
 * @param byTick decisions recorded for each tick, indexed by tick number.
 */
export function createReplayPolicy(byTick: ReadonlyMap<number, readonly Decision[]>): DecisionPolicy {
  return {
    id: 'replay',
    decide: (requests: readonly DecisionRequest[]): Promise<readonly Decision[]> => {
      const first = requests[0];
      if (!first) return Promise.resolve([]);
      const tick = first.percept.tick;
      const recorded = byTick.get(tick);
      if (!recorded) {
        // Silence here would look like a world where every dot chose to do
        // nothing, which is a very confusing way to discover a truncated log.
        throw new ReplayMismatch(`run log has no decisions for tick ${tick}`);
      }
      if (recorded.length !== requests.length) {
        throw new ReplayMismatch(
          `tick ${tick}: log has ${recorded.length} decisions, world asked for ${requests.length}`,
        );
      }
      return Promise.resolve(recorded);
    },
  };
}
