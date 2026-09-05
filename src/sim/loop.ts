/**
 * One turn of the crank: perceive, decide, act.
 *
 * Async because a policy may be, but free of I/O and Node built-ins, so this
 * runs unchanged in a browser bundle. The engine underneath stays synchronous
 * and pure — nothing here awaits inside `step`.
 */
import { buildGrid } from '../core/grid.js';
import { buildPercept } from '../core/percept.js';
import { step, type ArrivingStimulus } from '../core/step.js';
import type { Intent, WorldConfig, WorldEvent, WorldState } from '../core/types.js';
import type { Decision, DecisionPolicy, DecisionRequest, Personality } from '../policies/types.js';

export interface Advanced {
  readonly state: WorldState;
  readonly events: readonly WorldEvent[];
  readonly decisions: readonly Decision[];
}

export async function advance(
  state: WorldState,
  policy: DecisionPolicy,
  personalities: ReadonlyMap<string, Personality>,
  previousEvents: readonly WorldEvent[],
  config: WorldConfig,
  arrivals: readonly ArrivingStimulus[] = [],
): Promise<Advanced> {
  const grid = buildGrid(state.marks, state.width, state.height);
  const requests: DecisionRequest[] = [];
  for (const dot of state.dots) {
    const personality = personalities.get(dot.id);
    // A dot with no personality would silently never act. Better to say so.
    if (!personality) throw new Error(`no personality for ${dot.id}`);
    requests.push({ percept: buildPercept(state, dot, grid, previousEvents, config), personality });
  }

  const decisions = await policy.decide(requests);
  const intents: Intent[] = [];
  for (const d of decisions) intents.push(...d.intents);

  const result = step(state, intents, config, arrivals);
  return { state: result.state, events: result.events, decisions };
}
