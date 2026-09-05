/**
 * The vocabulary of the world. Terms here match `_knowledge/wiki/glossary.md`
 * one for one — if you rename something, rename it there too.
 */

export type DotId = string;
export type MarkId = string;

/** A topic id, not free text. Stimuli and marks carry these, never prose. */
export type Topic = string;

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** What a dot leaves behind. The only channel between dots. */
export interface Mark {
  readonly id: MarkId;
  readonly pos: Vec2;
  readonly topic: Topic;
  /** Decays every tick; the mark is dropped once it falls below `markEpsilon`. */
  readonly strength: number;
  readonly createdTick: number;
  readonly byDot: DotId;
}

/**
 * An enriched news item inside the world. It lands like weather rather than
 * arriving like a message: it creates topic pressure over a small area and
 * fades. A dot never reads the title — the world holds it for the viewer and
 * the log, but a dot only feels the pressure. See decision 0005.
 */
export interface Stimulus {
  readonly id: string;
  readonly sourceId: string;
  readonly title: string;
  readonly url: string | null;
  readonly topics: readonly Topic[];
  /** -1 grim, +1 bright. Carried for later; nothing reads it yet. */
  readonly valence: number;
  /** Decays every tick; dropped below `stimulusEpsilon`. */
  readonly intensity: number;
  readonly pos: Vec2;
  readonly arrivedTick: number;
}

export interface Dot {
  readonly id: DotId;
  readonly pos: Vec2;
  readonly colour: string;
  readonly energy: number;
  /** What the dot last said, and when. The viewer renders it as a bubble. */
  readonly saying: string | null;
  readonly sayingSinceTick: number;
}

/**
 * Everything the world is at a given tick. Owned exclusively by the engine:
 * no dot ever writes to it — see decision 0003.
 *
 * `marks` is the truth; the per-cell topic aggregate is derived from it by
 * `buildGrid`, never stored, so the two cannot drift apart.
 */
export interface WorldState {
  readonly tick: number;
  readonly seed: number;
  /** Serialised RNG state. Carrying it here is what makes a run resumable. */
  readonly rngState: number;
  /** Width and height in cells. Positions are continuous inside this box. */
  readonly width: number;
  readonly height: number;
  readonly dots: readonly Dot[];
  readonly marks: readonly Mark[];
  readonly stimuli: readonly Stimulus[];
  readonly nextMarkSeq: number;
}

/**
 * A *proposed* effect. Not to be confused with an intention (a dot's current
 * plan, which lives above the engine and emits many intents over its life).
 */
export type Intent =
  | { readonly kind: 'move'; readonly dotId: DotId; readonly dx: number; readonly dy: number }
  | { readonly kind: 'mark'; readonly dotId: DotId; readonly topic: Topic }
  | { readonly kind: 'rest'; readonly dotId: DotId }
  | { readonly kind: 'say'; readonly dotId: DotId; readonly text: string };

export type IntentKind = Intent['kind'];

/** Why an intent was refused. Rejection is normal, not exceptional. */
export type RejectReason = 'unknown-dot' | 'not-enough-energy' | 'empty-topic' | 'duplicate-intent';

/**
 * What happened during a tick. Events are the run log's payload and the
 * viewer's input; a dot also perceives the events naming it, which is how it
 * learns that an action failed.
 */
export type WorldEvent =
  | { readonly kind: 'moved'; readonly dotId: DotId; readonly from: Vec2; readonly to: Vec2 }
  | { readonly kind: 'move-clamped'; readonly dotId: DotId; readonly requested: Vec2; readonly applied: Vec2 }
  | { readonly kind: 'marked'; readonly dotId: DotId; readonly markId: MarkId; readonly reinforced: boolean }
  | { readonly kind: 'rested'; readonly dotId: DotId }
  | { readonly kind: 'said'; readonly dotId: DotId; readonly text: string }
  | { readonly kind: 'mark-faded'; readonly markId: MarkId }
  | { readonly kind: 'stimulus-arrived'; readonly stimulusId: string; readonly topics: readonly Topic[]; readonly title: string }
  | { readonly kind: 'stimulus-faded'; readonly stimulusId: string }
  | { readonly kind: 'intent-rejected'; readonly dotId: DotId; readonly intent: IntentKind; readonly reason: RejectReason };

export interface WorldConfig {
  readonly width: number;
  readonly height: number;
  /** Maximum distance a dot may travel in one tick. Movement beyond it is clamped, not refused. */
  readonly maxSpeed: number;
  readonly maxEnergy: number;
  readonly moveEnergyCost: number;
  readonly markEnergyCost: number;
  readonly restEnergyGain: number;
  /** Multiplied into every mark's strength each tick. */
  readonly markDecay: number;
  /** Marks weaker than this are dropped. */
  readonly markEpsilon: number;
  /** A new mark within this distance of one with the same topic reinforces it. */
  readonly markMergeDistance: number;
  readonly markInitialStrength: number;
  /** Ticks a `say` stays visible. */
  readonly sayDurationTicks: number;
  /** Multiplied into every stimulus's intensity each tick. */
  readonly stimulusDecay: number;
  readonly stimulusEpsilon: number;
  /**
   * Cells a stimulus is felt across, with linear falloff. Large on purpose: at
   * 3 a stimulus covers 1.2% of a 64x36 world and nobody ever walks into it.
   */
  readonly stimulusRadius: number;
}

export const DEFAULT_CONFIG: WorldConfig = {
  width: 64,
  height: 36,
  maxSpeed: 0.6,
  maxEnergy: 100,
  moveEnergyCost: 0.4,
  markEnergyCost: 3,
  restEnergyGain: 2,
  markDecay: 0.985,
  markEpsilon: 0.05,
  markMergeDistance: 1,
  markInitialStrength: 1,
  sayDurationTicks: 24,
  // Slower than marks: news should outlast the trails it provokes, otherwise
  // a dot can never follow one to its source before it is gone.
  stimulusDecay: 0.992,
  stimulusEpsilon: 0.08,
  stimulusRadius: 10,
};
