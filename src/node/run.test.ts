import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseArgs, runFresh, runReplay } from './run.js';
import { readRunLog } from './runlog.js';

const workspace = mkdtempSync(join(tmpdir(), 'dot-world-'));

const defaults = { ticks: 200, seed: 42, dots: 6, out: null, replay: null, quiet: true };

describe('argument parsing', () => {
  it('falls back to sensible defaults and reads the flags it is given', () => {
    expect(parseArgs([])).toEqual({ ticks: 1000, seed: 42, dots: 12, out: null, replay: null, quiet: false });
    expect(parseArgs(['--ticks', '5', '--seed', '7', '--dots', '2', '--out', 'x.jsonl', '--quiet'])).toEqual({
      ticks: 5, seed: 7, dots: 2, out: 'x.jsonl', replay: null, quiet: true,
    });
  });
});

describe('run log', () => {
  it('is self-contained: header plus one line per tick', () => {
    const path = join(workspace, 'shape.jsonl');
    return runFresh({ ...defaults, ticks: 25, out: path }).then(() => {
      const { header, ticks } = readRunLog(path);
      expect(header.seed).toBe(42);
      expect(header.dotCount).toBe(6);
      expect(header.policy).toBe('scripted');
      // Everything needed to rebuild the world from nothing, so a log never
      // depends on the flags someone happened to pass alongside it.
      expect(header.config.width).toBeGreaterThan(0);
      expect(header.initialHash).toMatch(/^[0-9a-f]{8}$/);
      expect(ticks).toHaveLength(25);
      expect(ticks[0]?.tick).toBe(0);
      expect(ticks[0]?.decisions).toHaveLength(6);
      expect(ticks.at(-1)?.tick).toBe(24);
    });
  });

  it('rejects a log written by a future version instead of misreading it', () => {
    const path = join(workspace, 'future.jsonl');
    writeFileSync(path, `${JSON.stringify({ kind: 'header', version: 99 })}\n`, 'utf8');
    expect(() => readRunLog(path)).toThrow(/version 99/);
  });
});

describe('replay', () => {
  it('reproduces a recorded run exactly, hash by hash', async () => {
    // This is the end-to-end check behind decision 0002's claim that a run
    // driven by real models can be replayed. The policy is scripted for now;
    // the mechanism being verified is the same one.
    const path = join(workspace, 'replay.jsonl');
    const fresh = await runFresh({ ...defaults, out: path });
    const replayed = await runReplay(path);

    expect(replayed.ticks).toBe(200);
    expect(replayed.firstDivergence).toBeNull();
    expect(replayed.finalHash).toBe(fresh.finalHash);
    expect(replayed.finalHash).toBe(replayed.expectedHash);
  });

  it('detects a tampered decision at the exact tick it was changed', async () => {
    // A replay that always says OK proves nothing. Change one dot's decision
    // at tick 100 and the divergence must be reported there, not at the end.
    const path = join(workspace, 'tamper.jsonl');
    await runFresh({ ...defaults, out: path });

    const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
    const target = JSON.parse(lines[101] as string) as { tick: number; decisions: { dotId: string; intents: unknown[] }[] };
    expect(target.tick).toBe(100);
    target.decisions[0]!.intents = [{ kind: 'rest', dotId: target.decisions[0]!.dotId }];
    lines[101] = JSON.stringify(target);

    const tampered = join(workspace, 'tampered.jsonl');
    writeFileSync(tampered, `${lines.join('\n')}\n`, 'utf8');

    const result = await runReplay(tampered);
    expect(result.firstDivergence).toBe(100);
  });

  it('refuses a log whose seed does not rebuild the world it claims', async () => {
    const path = join(workspace, 'badseed.jsonl');
    await runFresh({ ...defaults, ticks: 10, out: path });
    const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
    const header = JSON.parse(lines[0] as string) as { seed: number };
    header.seed = 999;
    lines[0] = JSON.stringify(header);
    const bad = join(workspace, 'badseed2.jsonl');
    writeFileSync(bad, `${lines.join('\n')}\n`, 'utf8');

    await expect(runReplay(bad)).rejects.toThrow(/initial state hash/);
  });
});
