/**
 * The run log: one JSON object per line, append-only.
 *
 * The header line carries everything needed to rebuild the world from nothing
 * — seed, dot count, config — so a log is self-contained and does not depend
 * on the flags someone happened to pass. Each tick line carries the decisions
 * taken and the resulting state hash, which is what replay checks against.
 *
 * Node-only: this is the I/O boundary. Nothing under `src/core` or `src/sim`
 * may import it.
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import type { WorldConfig } from '../core/types.js';
import type { Decision } from '../policies/types.js';

export const RUN_LOG_VERSION = 1;

export interface RunLogHeader {
  readonly kind: 'header';
  readonly version: number;
  readonly seed: number;
  readonly dotCount: number;
  readonly policy: string;
  readonly config: WorldConfig;
  /** Hash of the world before any tick, so replay can fail fast on a bad start. */
  readonly initialHash: string;
}

/**
 * Decisions and the resulting hash — deliberately no events. Events are
 * *output*: replaying the decisions regenerates them exactly, so storing them
 * is redundant, and dropping them cut a 1000-tick log from 2.48 MB to 1.40 MB.
 */
export interface RunLogTick {
  readonly kind: 'tick';
  readonly tick: number;
  readonly hash: string;
  readonly decisions: readonly Decision[];
}

export type RunLogLine = RunLogHeader | RunLogTick;

export function createRunLog(path: string, header: RunLogHeader): (line: RunLogTick) => void {
  writeFileSync(path, `${JSON.stringify(header)}\n`, 'utf8');
  return (line: RunLogTick): void => {
    appendFileSync(path, `${JSON.stringify(line)}\n`, 'utf8');
  };
}

export function readRunLog(path: string): { header: RunLogHeader; ticks: RunLogTick[] } {
  const lines = readFileSync(path, 'utf8').split('\n').filter((l) => l.length > 0);
  const first = lines[0];
  if (!first) throw new Error(`${path}: empty run log`);
  const header = JSON.parse(first) as RunLogLine;
  if (header.kind !== 'header') throw new Error(`${path}: first line is not a header`);
  if (header.version !== RUN_LOG_VERSION) {
    throw new Error(`${path}: run log version ${header.version}, this build reads ${RUN_LOG_VERSION}`);
  }
  const ticks: RunLogTick[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parsed = JSON.parse(lines[i] as string) as RunLogLine;
    if (parsed.kind !== 'tick') throw new Error(`${path}: line ${i + 1} is not a tick`);
    ticks.push(parsed);
  }
  return { header, ticks };
}
