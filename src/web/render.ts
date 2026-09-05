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

export interface RenderOptions {
  readonly theme: Theme;
  /** Dot to outline, if the inspector has one open. */
  readonly selected: string | null;
  /** Strongest mark strength seen so far, so alpha stays comparable over time. */
  readonly strengthScale: number;
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

  const radius = Math.max(3, scale * 0.34);
  for (const dot of state.dots) {
    ctx.beginPath();
    ctx.arc(px(dot.pos.x), py(dot.pos.y), radius, 0, Math.PI * 2);
    ctx.fillStyle = dot.colour;
    ctx.fill();
    if (dot.id === options.selected) {
      ctx.strokeStyle = options.theme.text;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Energy reads as opacity of a small inner core rather than a bar: a bar
    // over a 6-pixel dot is unreadable, and a dying dot going hollow is not.
    ctx.beginPath();
    ctx.arc(px(dot.pos.x), py(dot.pos.y), radius * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = options.theme.background;
    ctx.globalAlpha = Math.max(0, 1 - dot.energy / 100);
    ctx.fill();
    ctx.globalAlpha = 1;
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
  const radius = Math.max(3, scale * 0.34);

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
