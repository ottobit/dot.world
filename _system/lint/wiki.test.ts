/**
 * The automated half of Lint (see AGENTS.md).
 *
 * It only checks what is mechanically decidable: broken links, `covers:`
 * globs matching nothing, `exports:` symbols that no longer exist, orphan
 * pages, index drift, staleness. Contradictions between pages and claims a
 * newer source has superseded are the LLM's half of Lint — a test cannot see
 * those, and pretending otherwise would make this file a source of false
 * confidence.
 *
 * Staleness and orphans warn locally and fail under WIKI_STRICT=1 (CI), so
 * an in-progress branch is never blocked but a merge is.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const WIKI = join(REPO, '_system/wiki');
const STRICT = process.env.WIKI_STRICT === '1';

/** Pages that are lists by nature: no front-matter, exempt from the size rule. */
const SPECIAL = new Set(['index.md', 'log.md']);
const VALID_TYPES = new Set(['concept', 'decision', 'contract', 'recipe', 'source', 'finding']);
const MAX_LINES = 120;

interface Page {
  /** Path relative to the wiki root, e.g. `decisions/0001-foo.md`. */
  rel: string;
  abs: string;
  body: string;
  lines: number;
  front: Record<string, string | string[]>;
}

function walk(dir: string, base = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return walk(full, base);
    return e.isFile() && e.name.endsWith('.md') ? [relative(base, full)] : [];
  });
}

/**
 * Front-matter is a deliberately small YAML subset — `key: scalar` and
 * `key: [a, b]`. Hand-parsed rather than pulling in a YAML dependency for
 * seven keys.
 */
function parseFront(raw: string): { front: Record<string, string | string[]>; body: string } {
  if (!raw.startsWith('---\n')) return { front: {}, body: raw };
  const end = raw.indexOf('\n---', 4);
  if (end === -1) return { front: {}, body: raw };
  const front: Record<string, string | string[]> = {};
  for (const line of raw.slice(4, end).split('\n')) {
    const m = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const [, key, value] = m as unknown as [string, string, string];
    front[key] = value.startsWith('[')
      ? value.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean)
      : value.trim();
  }
  return { front, body: raw.slice(raw.indexOf('\n', end + 1) + 1) };
}

function loadPages(): Page[] {
  return walk(WIKI).sort().map((rel) => {
    const abs = join(WIKI, rel);
    const raw = readFileSync(abs, 'utf8');
    const { front, body } = parseFront(raw);
    return { rel, abs, body, lines: raw.split('\n').length, front };
  });
}

/** GitHub's heading-anchor slug. */
function slug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

function anchorsOf(file: string): Set<string> {
  const out = new Set<string>();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^#{1,6}\s+(.*)$/.exec(line);
    if (m?.[1]) out.add(slug(m[1]));
  }
  return out;
}

/** Markdown links, skipping images and anything with a scheme. */
function linksOf(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(/(!?)\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const [, bang, target] = m as unknown as [string, string, string];
    if (bang === '!' || /^[a-z]+:/i.test(target) || target.startsWith('#')) continue;
    out.push(target);
  }
  return out;
}

function globToRe(glob: string): RegExp {
  const src = glob
    .split('**').map((p) => p.split('*').map((s) => s.replace(/[.+^${}()|[\]\\]/g, '\\$&')).join('[^/]*'))
    .join('.*');
  return new RegExp(`^${src}$`);
}

function allRepoFiles(dir: string, base = REPO, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) allRepoFiles(full, base, acc);
    else acc.push(relative(base, full));
  }
  return acc;
}

function exportedNames(absFile: string): Set<string> {
  const src = ts.createSourceFile(absFile, readFileSync(absFile, 'utf8'), ts.ScriptTarget.ESNext, true);
  const out = new Set<string>();
  const isExported = (n: ts.Node): boolean =>
    ts.canHaveModifiers(n) && !!ts.getModifiers(n)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  for (const st of src.statements) {
    if (ts.isVariableStatement(st) && isExported(st)) {
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) out.add(d.name.text);
    } else if (
      (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isInterfaceDeclaration(st) ||
        ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st)) && isExported(st) && st.name
    ) {
      out.add(st.name.text);
    } else if (ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause)) {
      for (const el of st.exportClause.elements) out.add(el.name.text);
    }
  }
  return out;
}

function lastCommitDate(file: string): string | null {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], {
      cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

/** Fails under WIKI_STRICT=1, otherwise reports and moves on. */
function soft(label: string, problems: string[]): void {
  if (problems.length === 0) return;
  if (STRICT) expect.soft(problems, label).toEqual([]);
  else console.warn(`[wiki lint] ${label} (${problems.length}):\n  ${problems.join('\n  ')}`);
}

const pages = loadPages();

describe('wiki front-matter', () => {
  it('every page has parseable front-matter with a valid id, type and title', () => {
    const problems: string[] = [];
    for (const p of pages) {
      if (SPECIAL.has(p.rel)) continue;
      const { id, type, title, updated } = p.front;
      if (id !== p.rel.replace(/\.md$/, '')) problems.push(`${p.rel}: id is "${String(id)}", expected "${p.rel.replace(/\.md$/, '')}"`);
      if (typeof type !== 'string' || !VALID_TYPES.has(type)) problems.push(`${p.rel}: invalid type "${String(type)}"`);
      if (typeof title !== 'string' || !title.endsWith('?')) problems.push(`${p.rel}: title must be the question the page answers`);
      if (typeof updated !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(updated)) problems.push(`${p.rel}: missing or malformed "updated"`);
    }
    expect(problems).toEqual([]);
  });

  it('no page has drifted past the size limit', () => {
    const over = pages.filter((p) => !SPECIAL.has(p.rel) && p.rel !== 'glossary.md' && p.lines > MAX_LINES);
    soft('pages over the size limit — split them', over.map((p) => `${p.rel} (${p.lines} lines)`));
  });
});

describe('wiki links', () => {
  const roots = [...pages.map((p) => p.abs), join(REPO, 'AGENTS.md'), join(REPO, 'CLAUDE.md')];

  it('every internal link resolves to a real file, directory and anchor', () => {
    const problems: string[] = [];
    for (const abs of roots) {
      for (const link of linksOf(readFileSync(abs, 'utf8'))) {
        const [path, anchor] = link.split('#') as [string, string | undefined];
        const target = resolve(dirname(abs), path);
        let stats;
        try {
          stats = statSync(target);
        } catch {
          problems.push(`${relative(REPO, abs)} → ${link} (no such path)`);
          continue;
        }
        if (anchor && stats.isFile() && !anchorsOf(target).has(anchor)) {
          problems.push(`${relative(REPO, abs)} → ${link} (no such anchor)`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('wiki index', () => {
  const indexBody = readFileSync(join(WIKI, 'index.md'), 'utf8');
  const listed = new Set(linksOf(indexBody).filter((l) => l.endsWith('.md')).map((l) => l.split('#')[0]));

  it('lists every page, and lists nothing that does not exist', () => {
    const missing = pages
      .filter((p) => p.rel !== 'index.md' && !listed.has(p.rel))
      .map((p) => `${p.rel} is not in index.md`);
    expect(missing).toEqual([]);
  });
});

describe('wiki ↔ code', () => {
  const repoFiles = allRepoFiles(REPO);

  it('every `covers:` glob matches at least one real file', () => {
    const problems: string[] = [];
    for (const p of pages) {
      for (const g of (p.front.covers ?? []) as string[]) {
        if (!repoFiles.some((f) => globToRe(g).test(f))) problems.push(`${p.rel}: covers "${g}" matches nothing`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('every symbol in `exports:` is actually exported by a covered file', () => {
    const problems: string[] = [];
    for (const p of pages) {
      const symbols = (p.front.exports ?? []) as string[];
      if (symbols.length === 0) continue;
      const covered = repoFiles.filter((f) =>
        f.endsWith('.ts') && ((p.front.covers ?? []) as string[]).some((g) => globToRe(g).test(f)),
      );
      const exported = new Set(covered.flatMap((f) => [...exportedNames(join(REPO, f))]));
      for (const s of symbols) if (!exported.has(s)) problems.push(`${p.rel}: "${s}" is not exported by any file in covers`);
    }
    expect(problems).toEqual([]);
  });

  it('reports pages whose covered code changed after the page did', () => {
    const stale: string[] = [];
    for (const p of pages) {
      const updated = p.front.updated;
      if (typeof updated !== 'string') continue;
      for (const g of (p.front.covers ?? []) as string[]) {
        for (const f of repoFiles.filter((f) => globToRe(g).test(f))) {
          const committed = lastCommitDate(f);
          if (committed && committed > updated) stale.push(`${p.rel} (updated ${updated}) — ${f} changed ${committed}`);
        }
      }
    }
    soft('stale pages', stale);
  });
});

describe('wiki graph', () => {
  it('reports orphan pages with no inbound link from another page', () => {
    const inbound = new Map(pages.map((p) => [p.rel, 0]));
    for (const p of pages) {
      if (p.rel === 'index.md') continue; // the index links everything by construction
      for (const link of linksOf(p.body)) {
        const target = relative(WIKI, resolve(dirname(p.abs), link.split('#')[0] ?? ''));
        if (inbound.has(target) && target !== p.rel) inbound.set(target, (inbound.get(target) ?? 0) + 1);
      }
    }
    const orphans = [...inbound]
      .filter(([rel, n]) => n === 0 && !SPECIAL.has(rel))
      .map(([rel]) => `${rel} has no inbound link outside index.md`);
    soft('orphan pages', orphans);
  });
});
