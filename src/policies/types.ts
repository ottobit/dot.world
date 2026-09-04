/**
 * Layer 2 of the inference split (decision 0004): percept in, action out.
 * Knows nothing about HTTP, endpoints or prompts.
 *
 * `decide` takes every request for the tick at once rather than one at a time,
 * so a model-backed policy can batch them into a single call without the
 * caller changing shape.
 */
import type { Intent, Topic } from '../core/types.js';
import type { Percept } from '../core/percept.js';

/** What a dot cares about. Lives here, not in the world state: it is what a dot knows. */
export interface Personality {
  readonly interests: Readonly<Record<Topic, number>>;
  /** 0 = never acts on impulse, 1 = rarely holds still. Shapes the scripted policy. */
  readonly restlessness: number;
}

export interface DecisionRequest {
  readonly percept: Percept;
  readonly personality: Personality;
}

export interface Decision {
  readonly dotId: string;
  readonly intents: readonly Intent[];
  /** Why, in a few words. Shown in the viewer's inspector; not used by the engine. */
  readonly rationale: string;
}

export interface DecisionPolicy {
  readonly id: string;
  decide(requests: readonly DecisionRequest[]): Promise<readonly Decision[]>;
}
