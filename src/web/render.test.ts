import { describe, expect, it } from 'vitest';
import { eyeGeometry, isBlinking, MIN_RADIUS_FOR_EYES, topicColour } from './render.js';

describe('eye geometry', () => {
  it('refuses to draw eyes smaller than a pixel', () => {
    // Two grey smudges are worse than no face. Below the threshold the dot
    // stays a plain ball rather than becoming mush.
    expect(eyeGeometry(MIN_RADIUS_FOR_EYES - 0.1, [0, 0])).toBeNull();
    expect(eyeGeometry(MIN_RADIUS_FOR_EYES, [0, 0])).not.toBeNull();
  });

  it('keeps the mascot proportions', () => {
    // The portfolio's dot: a 38px ball with 7px eyes 7px apart, so an eye is
    // 0.19 of the radius and sits 0.37 out from the centre.
    const g = eyeGeometry(19, [0, 0])!;
    expect(g.radius).toBeCloseTo(3.6, 1);
    expect(g.left[0]).toBeCloseTo(-7.0, 1);
    expect(g.right[0]).toBeCloseTo(7.0, 1);
    expect(g.left[1]).toBe(g.right[1]);
    // Deliberately not the same: slightly above centre, which reads alert.
    expect(g.left[1]).toBeLessThan(0);
  });

  it('looks where it is told, symmetrically', () => {
    const east = eyeGeometry(20, [1, 0])!;
    const west = eyeGeometry(20, [-1, 0])!;
    expect(east.left[0]).toBeGreaterThan(eyeGeometry(20, [0, 0])!.left[0]);
    expect(east.left[0] + west.left[0]).toBeCloseTo(2 * eyeGeometry(20, [0, 0])!.left[0], 6);
  });

  it('never lets a pupil leave the face', () => {
    // Every corner of the gaze square, at the extreme: an eye that slides off
    // the ball stops being a face and starts being a bug.
    for (const gx of [-1, 0, 1]) {
      for (const gy of [-1, 0, 1]) {
        const r = 20;
        const g = eyeGeometry(r, [gx, gy])!;
        for (const [ex, ey] of [g.left, g.right]) {
          expect(Math.sqrt(ex * ex + ey * ey) + g.radius, `gaze ${gx},${gy}`).toBeLessThanOrEqual(r);
        }
      }
    }
  });
});

describe('blinking', () => {
  it('is derived from the dot and the tick, so a replay blinks identically', () => {
    for (let tick = 0; tick < 50; tick++) {
      expect(isBlinking('dot-003', tick)).toBe(isBlinking('dot-003', tick));
    }
  });

  it('does not blink twelve dots in unison', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `dot-${String(i).padStart(3, '0')}`);
    let everyoneAtOnce = 0;
    for (let tick = 0; tick < 500; tick++) {
      if (ids.every((id) => isBlinking(id, tick))) everyoneAtOnce += 1;
    }
    expect(everyoneAtOnce).toBe(0);
  });

  it('blinks each dot sometimes, and mostly does not', () => {
    const blinks = Array.from({ length: 440 }, (_, t) => isBlinking('dot-000', t)).filter(Boolean).length;
    expect(blinks).toBeGreaterThan(0);
    expect(blinks / 440).toBeLessThan(0.1);
  });
});

describe('topic colours', () => {
  it('falls back rather than drawing nothing for a topic it does not know', () => {
    expect(topicColour('ai')).not.toBe(topicColour('something-new'));
    expect(topicColour('something-new')).toMatch(/^#[0-9a-f]{6}$/);
  });
});
