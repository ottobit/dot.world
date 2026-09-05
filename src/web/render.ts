/**
 * Drawing the world on a canvas. Reads state, never changes it.
 *
 * Marks are drawn under the dots and fade with their strength, so what you see
 * is the stigmergic layer itself: the trails are the memory of the world, and
 * watching them thicken and fade is watching dots coordinate without ever
 * talking to each other.
 */
import { cellOf } from '../core/grid.js';
import type { Topic, WorldState } from '../core/types.js';

/**
 * One colour per topic, so a trail is readable at a glance. Same palette
 * family as the mascot's clone colours on the portfolio.
 */
export const TOPIC_COLOURS: Readonly<Record<Topic, string>> = {
  ai: '#7c3aed',
  space: '#2563eb',
  weather: '#0891b2',
  world: '#16a34a',
  code: '#ea580c',
  trending: '#db2777',
};
const UNKNOWN_TOPIC = '#94a3b8';

/**
 * Pure white, in both themes, exactly as the mascot's eyes are. It is also the
 * only pure white the canvas ever paints, which is what lets an end-to-end test
 * prove the eyes are actually drawn rather than assume it.
 */
const EYE_COLOUR = '#ffffff';

export interface Theme {
  readonly background: string;
  readonly grid: string;
  readonly text: string;
  readonly bubble: string;
  readonly bubbleText: string;
}

export const THEMES: Readonly<Record<'light' | 'dark', Theme>> = {
  light: { background: '#fbfbf9', grid: '#eceae4', text: '#1c1b19', bubble: '#ffffff', bubbleText: '#1c1b19' },
  dark: { background: '#16161a', grid: '#232329', text: '#e9e9ec', bubble: '#26262c', bubbleText: '#e9e9ec' },
};

export function topicColour(topic: Topic): string {
  return TOPIC_COLOURS[topic] ?? UNKNOWN_TOPIC;
}

/**
 * Where a dot's eyes go.
 *
 * The proportions come from the mascot on the portfolio — a 38px ball with two
 * 7px eyes 7px apart, so an eye is 0.19 of the radius and sits 0.37 out from
 * the centre. Two things are deliberately not the same: the eyes sit slightly
 * above centre, which reads as alert rather than sleepy, and they follow where
 * the dot *intends* to go instead of following the cursor. These are not the
 * portfolio's dot. They are its relatives.
 *
 * Pure and exported so the geometry can be tested without a canvas.
 */
export interface EyeGeometry {
  readonly radius: number;
  readonly left: readonly [number, number];
  readonly right: readonly [number, number];
}

/** Below this radius in device pixels an eye is smaller than a pixel: mush. */
export const MIN_RADIUS_FOR_EYES = 4.5;

export function eyeGeometry(radius: number, gaze: readonly [number, number]): EyeGeometry | null {
  if (radius < MIN_RADIUS_FOR_EYES) return null;
  const eyeR = radius * 0.19;
  const spread = radius * 0.37;
  // Clamped so a pupil never leaves the face, however hard the dot is staring.
  const reach = radius * 0.22;
  const gx = gaze[0] * reach;
  const gy = gaze[1] * reach;
  const lift = -radius * 0.08;
  return {
    radius: eyeR,
    left: [-spread + gx, lift + gy],
    right: [spread + gx, lift + gy],
  };
}

/**
 * A blink, derived from the dot's id and the tick rather than from a timer, so
 * twelve dots never blink in unison and a replay blinks identically.
 */
export function isBlinking(dotId: string, tick: number): boolean {
  let h = 0x811c9dc5;
  for (let i = 0; i < dotId.length; i++) {
    h ^= dotId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const phase = (tick + (h >>> 0)) % 220;
  return phase < 5;
}

export interface RenderOptions {
  readonly theme: Theme;
  /** Dot to outline, if the inspector has one open. */
  readonly selected: string | null;
  /** Strongest mark strength seen so far, so alpha stays comparable over time. */
  readonly strengthScale: number;
  /** Where each dot is looking, as a unit-ish vector. Missing means straight ahead. */
  readonly gaze: ReadonlyMap<string, readonly [number, number]>;
}

export function draw(
  ctx: CanvasRenderingContext2D,
  state: WorldState,
  options: RenderOptions,
): void {
  const canvas = ctx.canvas;
  const scale = Math.min(canvas.width / state.width, canvas.height / state.height);
  const originX = (canvas.width - state.width * scale) / 2;
  const originY = (canvas.height - state.height * scale) / 2;
  const px = (x: number): number => originX + x * scale;
  const py = (y: number): number => originY + y * scale;

  ctx.fillStyle = options.theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Cell grid, very faint: it makes the quantisation the percept uses visible
  // without competing with anything.
  ctx.strokeStyle = options.theme.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= state.width; x += 4) {
    ctx.moveTo(px(x), py(0));
    ctx.lineTo(px(x), py(state.height));
  }
  for (let y = 0; y <= state.height; y += 4) {
    ctx.moveTo(px(0), py(y));
    ctx.lineTo(px(state.width), py(y));
  }
  ctx.stroke();

  for (const mark of state.marks) {
    const { cx, cy } = cellOf(mark.pos);
    ctx.globalAlpha = Math.min(0.75, 0.12 + (mark.strength / options.strengthScale) * 0.6);
    ctx.fillStyle = topicColour(mark.topic);
    ctx.fillRect(px(cx), py(cy), scale, scale);
  }
  ctx.globalAlpha = 1;

  // Bigger than the first pass: at 0.34 of a cell an eye came out under a
  // pixel, and two grey smudges are worse than no face at all.
  const radius = Math.max(3, scale * 0.45);
  for (const dot of state.dots) {
    const cx = px(dot.pos.x);
    const cy = py(dot.pos.y);

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = dot.colour;
    ctx.fill();
    if (dot.id === options.selected) {
      ctx.strokeStyle = options.theme.text;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Energy as a hollow core rather than a bar — a bar over a small dot is
    // unreadable, a dot going hollow as it tires is not. Drawn before the eyes
    // so an exhausted dot looks drained, not blindfolded.
    if (dot.energy < 100) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = options.theme.background;
      ctx.globalAlpha = Math.min(0.85, Math.max(0, 1 - dot.energy / 100));
      ctx.fill();
      ctx.restore();
    }

    const eyes = eyeGeometry(radius, options.gaze.get(dot.id) ?? [0, 0]);
    if (!eyes) continue;
    ctx.fillStyle = EYE_COLOUR;
    if (isBlinking(dot.id, state.tick)) {
      // A blink is a line, not a smaller circle: a shrinking eye reads as
      // squinting, a flat one reads as a blink.
      const h = Math.max(1, eyes.radius * 0.4);
      for (const [ex, ey] of [eyes.left, eyes.right]) {
        ctx.fillRect(cx + ex - eyes.radius, cy + ey - h / 2, eyes.radius * 2, h);
      }
      continue;
    }
    for (const [ex, ey] of [eyes.left, eyes.right]) {
      ctx.beginPath();
      ctx.arc(cx + ex, cy + ey, eyes.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  for (const dot of state.dots) {
    if (!dot.saying) continue;
    const text = dot.saying;
    const w = ctx.measureText(text).width + 12;
    const x = px(dot.pos.x) + radius + 6;
    const y = py(dot.pos.y) - radius - 8;
    ctx.fillStyle = options.theme.bubble;
    ctx.strokeStyle = dot.colour;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y - 11, w, 22, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = options.theme.bubbleText;
    ctx.fillText(text, x + 6, y);
  }
}

/** The dot under a canvas click, if any. */
export function hitTest(
  state: WorldState,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): string | null {
  const rect = canvas.getBoundingClientRect();
  const cx = ((clientX - rect.left) / rect.width) * canvas.width;
  const cy = ((clientY - rect.top) / rect.height) * canvas.height;
  const scale = Math.min(canvas.width / state.width, canvas.height / state.height);
  const originX = (canvas.width - state.width * scale) / 2;
  const originY = (canvas.height - state.height * scale) / 2;
  const radius = Math.max(3, scale * 0.45);

  let best: { id: string; d: number } | null = null;
  for (const dot of state.dots) {
    const dx = originX + dot.pos.x * scale - cx;
    const dy = originY + dot.pos.y * scale - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    // A generous target: a 6-pixel circle is not a click target on a laptop.
    if (d <= radius * 3 && (best === null || d < best.d)) best = { id: dot.id, d };
  }
  return best?.id ?? null;
}
