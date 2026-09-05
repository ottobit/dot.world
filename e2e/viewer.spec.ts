/**
 * The viewer, driven in a real browser.
 *
 * Unit tests cannot tell you the page renders. These assertions deliberately
 * read the world through the page's own hook and the pixels on the canvas,
 * rather than trusting that a green build means a working page.
 */
import { expect, test, type Page } from '@playwright/test';

interface DotWorldHook {
  ready: Promise<void>;
  state(): { tick: number; dots: { id: string }[]; marks: unknown[] };
  select(id: string): void;
  running(): boolean;
}
declare global {
  interface Window { dotWorld: DotWorldHook }
}

/** Fails the test on any console error, rather than letting the page limp on. */
function failOnConsoleErrors(page: Page, sink: string[]): void {
  page.on('console', (m) => { if (m.type() === 'error') sink.push(m.text()); });
  page.on('pageerror', (e) => sink.push(String(e)));
}

test('renders twelve dots, grows marks, and opens the inspector', async ({ page }) => {
  const errors: string[] = [];
  failOnConsoleErrors(page, errors);

  await page.goto('/');
  await page.evaluate(() => window.dotWorld.ready);

  const dots = await page.evaluate(() => window.dotWorld.state().dots.map((d) => d.id));
  expect(dots).toHaveLength(12);

  // The world must actually advance, not just paint one frame.
  await expect.poll(() => page.evaluate(() => window.dotWorld.state().tick)).toBeGreaterThan(20);

  // And the stigmergic layer must fill: this is the regression that a
  // 1000-tick headless run caught once, and the one thing that makes the
  // world more than twelve dots wandering past each other.
  await expect
    .poll(() => page.evaluate(() => window.dotWorld.state().marks.length), { timeout: 30_000 })
    .toBeGreaterThan(0);

  const first = dots[0]!;
  await page.evaluate((id) => window.dotWorld.select(id), first);
  const inspector = page.locator('#inspector');
  await expect(inspector).toContainText(first);
  // The percept is the prompt: seeing it is the point of the inspector.
  await expect(inspector).toContainText('Percept');
  await expect(inspector).toContainText('neighbours');
  await expect(page.locator('#inspector-hint')).toBeHidden();

  expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
});

test('pause actually stops the world', async ({ page }) => {
  const errors: string[] = [];
  failOnConsoleErrors(page, errors);

  await page.goto('/');
  await page.evaluate(() => window.dotWorld.ready);
  await page.getByRole('button', { name: 'Pause' }).click();

  const paused = await page.evaluate(() => window.dotWorld.state().tick);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.dotWorld.state().tick)).toBe(paused);

  await page.getByRole('button', { name: 'Step' }).click();
  await expect.poll(() => page.evaluate(() => window.dotWorld.state().tick)).toBe(paused + 1);

  expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
});

test('the canvas is painted, not blank', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.dotWorld.ready);
  await expect.poll(() => page.evaluate(() => window.dotWorld.state().tick)).toBeGreaterThan(5);

  // Count distinct colours on the canvas. A blank or single-fill canvas gives
  // one or two; dots on a background give many. This is the assertion that
  // would have caught "everything runs, nothing is drawn".
  const distinct = await page.evaluate(() => {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    const seen = new Set<number>();
    for (let i = 0; i < data.length; i += 4) {
      seen.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
    }
    return seen.size;
  });
  expect(distinct).toBeGreaterThan(5);
});

test('replay mode re-plays a recorded run', async ({ page }) => {
  const errors: string[] = [];
  failOnConsoleErrors(page, errors);

  // The same mechanism the headless runner verifies hash by hash — this checks
  // it survives the trip through a browser: fetch, parse, ReplayPolicy, canvas.
  await page.goto('/?replay=./sample-run.jsonl');
  await page.evaluate(() => window.dotWorld.ready);

  await expect(page.locator('#mode')).toContainText('replay');
  expect(await page.evaluate(() => window.dotWorld.state().dots.length)).toBe(8);

  // ReplayPolicy throws on a tick the log does not carry, so reaching the end
  // without a console error is itself the assertion that every tick matched.
  await expect
    .poll(() => page.evaluate(() => window.dotWorld.state().tick), { timeout: 60_000 })
    .toBe(300);
  expect(await page.evaluate(() => window.dotWorld.running())).toBe(false);
  expect(await page.evaluate(() => window.dotWorld.state().marks.length)).toBeGreaterThan(0);

  expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
});
