---
id: contracts/viewer
type: contract
title: What does the viewer run, and why is it not a rendering of a simulation?
covers: [src/web/main.ts, src/web/render.ts, vite.config.ts, playwright.config.ts]
exports: [draw, hitTest, topicColour, TOPIC_COLOURS, THEMES, eyeGeometry, isBlinking, MIN_RADIUS_FOR_EYES]
depends_on: [decisions/0001-typescript-isomorphic-engine, contracts/run-log, concepts/percept]
updated: 2026-09-05
---

# Contract — the viewer

**When to open this page.** Before adding anything to `src/web`, and before
assuming the page shows a recording.

**The page runs the engine.** `src/core` and `src/sim` import nothing from
Node, so the same `step` that the headless runner drives runs in the browser.
What you watch is not a rendering of a simulation that happened elsewhere; it
is the simulation. That is what decision
[`0001`](../decisions/0001-typescript-isomorphic-engine.md) bought.

## Two modes

| mode | how | what it is for |
|---|---|---|
| **live** (default) | engine in the page, `ScriptedPolicy` | a demo with no backend, no key, no server |
| **replay** | `?replay=<url>` loads a run log | showing a run driven by real models on a static page |

Replay is the one that matters later: a model run is recorded once, and the
recorded decisions are re-played in a browser that never sees an API key.

## What is drawn, and why that way

- **Marks under the dots**, alpha scaled by strength. The trails *are* the
  memory of the world — watching them thicken and fade is watching dots
  coordinate without ever talking.
- **The cell grid, very faint.** It makes the quantisation the
  [percept](../concepts/percept.md) uses visible without competing with
  anything.
- **Energy as a hollow core**, not a bar. A bar over a six-pixel dot is
  unreadable; a dying dot going hollow is not. Drawn under the eyes, so a tired
  dot looks drained rather than blindfolded.
- **Eyes**, and they are the point of the next section.
- **The inspector** shows the exact percept, the decision and the rationale.
  It is what makes this a thing you can reason about rather than an aquarium.

## The dots have faces

The proportions come from the mascot on the portfolio: a 38px ball with two
7px eyes 7px apart, so an eye is **0.19 of the radius** and sits **0.37 out**
from the centre. `eyeGeometry` is pure and exported, so those numbers are
tested without a canvas.

Two things are deliberately **not** the same, because these are not that dot —
they are its relatives:

- The eyes sit slightly above centre, which reads alert rather than sleepy.
- **They follow where the dot intends to go**, not the cursor. The gaze comes
  from the move intent its policy produced, so the eyes show the decision a
  tick before the body finishes carrying it out — and a world of dots looking
  in different directions is readable at a glance in a way a world of identical
  balls is not.

A blink is derived from the dot id and the tick rather than a timer, so twelve
dots never blink in unison and a replay blinks identically. It draws as a flat
line: a shrinking circle reads as squinting.

**Below `MIN_RADIUS_FOR_EYES` the dot stays a plain ball.** An eye at 0.19 of a
five-pixel radius is under a pixel, and two grey smudges are worse than no
face. The dot radius went from 0.34 to 0.45 of a cell for the same reason.

## What NOT to do

- **Do not import anything from `src/node` here.** It would break the bundle,
  and the break shows up at runtime on the deployed page, not at build time.
- **Do not let the viewer mutate the world.** It reads state and draws it. The
  `window.dotWorld` hook exposes reads and a selection, nothing else.
- **Do not raise the build target to get top-level `await`.** It was tried;
  `es2020` keeps older browsers, and a wrapper function costs three lines.
- **Do not assert only through the DOM in the end-to-end test.** One test
  counts distinct colours on the canvas, because "everything runs, nothing is
  drawn" passes every DOM assertion there is. Another counts **pure white**
  pixels, which the canvas paints for eyes and nothing else — the background is
  `#fbfbf9`, the marks are topic colours, the dots are the clone palette.
- **Do not paint anything else pure white.** That assertion is the only proof
  the faces are actually drawn.
- **Do not put the gaze in the world state.** It is a rendering of intent, not
  a fact about the world, and a dot cannot see another's eyes anyway.

## Verification

`npm run e2e` drives Chromium. It asserts twelve dots, a world that actually
advances, marks that appear, faces that are painted, an inspector that opens
with the percept in it, pause that really stops, step that advances exactly one
tick, and **zero console errors** — a 404 on a missing favicon failed this and was fixed by
adding the favicon rather than by loosening the assertion.

A 300-tick sample run ships as a page asset so replay mode is exercised end to
end rather than assumed: `?replay=./sample-run.jsonl`.

## See also

- [`contracts/run-log.md`](run-log.md) — what replay mode reads
