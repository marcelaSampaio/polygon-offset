import { describe, it, expect } from 'vitest';
import {
  offsetPolygon, offsetPolygonToLoops, naiveOffsetPolygon, maxDeviation,
  area, signedArea, distanceToPolygon, pointInPolygon,
} from '../src';
import { pt, square, lBend, neck, star, regularPolygon } from './fixtures';

/** The contract: every returned point sits at |distance| from the source. */
const expectOnBand = (result: ReturnType<typeof offsetPolygon>, poly: typeof square, d: number, tol = 1e-6) => {
  expect(result.length).toBeGreaterThan(0);
  expect(maxDeviation(result, poly, d)).toBeLessThanOrEqual(tol);
};

describe('offsetPolygon — the distance contract', () => {
  const shapes: [string, typeof square][] = [
    ['square', square],
    ['L bend (one reflex corner)', lBend],
    ['5-point star', star()],
    ['narrow neck', neck],
    ['near-circle', regularPolygon(64, 80)],
  ];

  for (const [name, poly] of shapes) {
    for (const d of [2, 10, 25]) {
      it(`${name}: every point of a +${d} offset is exactly ${d} away`, () => {
        expectOnBand(offsetPolygon(poly, d), poly, d);
      });
    }
    it(`${name}: holds for a negative offset too`, () => {
      expectOnBand(offsetPolygon(poly, -6), poly, 6);
    });
  }

  it('holds at a sharp corner, where the naive method is worst', () => {
    const spike = star(5, 140, 20); // very sharp arms
    expectOnBand(offsetPolygon(spike, 15), spike, 15);
  });
});

describe('offsetPolygon — behaviour', () => {
  it('grows the area on a positive offset and shrinks it on a negative one', () => {
    expect(area(offsetPolygon(square, 10))).toBeGreaterThan(area(square));
    expect(area(offsetPolygon(square, -10))).toBeLessThan(area(square));
  });

  it('reads orientation from the input, so reversed winding still grows outward', () => {
    const reversed = [...square].reverse();
    const out = offsetPolygon(reversed, 10);
    // an outward offset must contain points outside the original square
    expect(out.some((p) => !pointInPolygon(p, square))).toBe(true);
    expect(out.every((p) => pointInPolygon(p, square))).toBe(false);
  });

  it('returns a copy of the input for a zero offset', () => {
    const out = offsetPolygon(square, 0);
    expect(out).toEqual(square);
    expect(out[0]).not.toBe(square[0]);
  });

  it('returns degenerate input untouched instead of throwing', () => {
    expect(offsetPolygon([pt(0, 0), pt(1, 1)], 5)).toHaveLength(2);
    expect(offsetPolygon([], 5)).toEqual([]);
  });

  it('drops the points that a shrinking offset eats, rather than folding them', () => {
    // Shrinking the neck past its half-width must remove the waist entirely.
    const halfWaist = 8; // the neck is 16 units across at its narrowest
    const out = offsetPolygon(neck, -(halfWaist + 6));
    const waist = out.filter((p) => p.y > 90 && p.y < 110);
    expect(waist).toHaveLength(0);
    expect(out.length).toBeGreaterThan(0);
  });

  it('never emits a point closer to the source than the requested distance', () => {
    const d = 18;
    for (const p of offsetPolygon(star(), d)) {
      expect(distanceToPolygon(p, star())).toBeGreaterThan(d - 1e-6);
    }
  });

  it('gives a finer result for a smaller sampleStep', () => {
    const coarse = offsetPolygon(square, 10, { sampleStep: 20 });
    const fine = offsetPolygon(square, 10, { sampleStep: 2 });
    expect(fine.length).toBeGreaterThan(coarse.length);
    expectOnBand(fine, square, 10);
  });

  it('keeps the corner on the band at any arcSegments setting', () => {
    for (const arcSegments of [1, 4, 64]) {
      expectOnBand(offsetPolygon(square, 10, { arcSegments }), square, 10);
    }
  });

  it('does not throw a spike at a near-degenerate corner', () => {
    const sliver = [pt(0, 0), pt(200, 0), pt(200, 0.05)];
    const out = offsetPolygon(sliver, 10);
    for (const p of out) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(Math.hypot(p.x, p.y)).toBeLessThan(1e4);
    }
  });

  it('preserves winding sign in the result', () => {
    expect(Math.sign(signedArea(offsetPolygon(square, 10)))).toBe(Math.sign(signedArea(square)));
  });
});

describe('naiveOffsetPolygon — kept so the error is measurable', () => {
  it('is correct on a shape with no corners to speak of', () => {
    const circle = regularPolygon(256, 100);
    expect(maxDeviation(naiveOffsetPolygon(circle, 10), circle, 10)).toBeLessThan(0.05);
  });

  it('is badly wrong on a star, where offsetPolygon is exact', () => {
    const s = star();
    const naive = maxDeviation(naiveOffsetPolygon(s, 40), s, 40);
    const good = maxDeviation(offsetPolygon(s, 40), s, 40);
    expect(naive).toBeGreaterThan(20);   // more than half the requested distance
    expect(good).toBeLessThan(1e-6);
    expect(naive / Math.max(good, 1e-12)).toBeGreaterThan(1e6);
  });

  it('gets worse as the corner sharpens', () => {
    const blunt = maxDeviation(naiveOffsetPolygon(star(5, 120, 90), 20), star(5, 120, 90), 20);
    const sharp = maxDeviation(naiveOffsetPolygon(star(5, 120, 20), 20), star(5, 120, 20), 20);
    expect(sharp).toBeGreaterThan(blunt);
  });
});

describe('maxDeviation', () => {
  it('is zero for an empty result', () => {
    expect(maxDeviation([], square, 10)).toBe(0);
  });

  it('reports the true error of a deliberately wrong result', () => {
    expect(maxDeviation([pt(50, -30)], square, 10)).toBeCloseTo(20, 9);
  });
});

describe('offsetPolygonToLoops', () => {
  it('returns a single loop when the topology does not change', () => {
    for (const poly of [square, lBend, star()]) {
      expect(offsetPolygonToLoops(poly, 8)).toHaveLength(1);
    }
  });

  it('splits the neck into two loops once the waist is eaten', () => {
    const loops = offsetPolygonToLoops(neck, -15);
    expect(loops).toHaveLength(2);
    for (const loop of loops) {
      expect(loop.length).toBeGreaterThan(2);
      expect(maxDeviation(loop, neck, 15)).toBeLessThan(1e-6);
    }
  });

  it('keeps every point that offsetPolygon returned', () => {
    const flat = offsetPolygon(neck, -15);
    const total = offsetPolygonToLoops(neck, -15).reduce((n, l) => n + l.length, 0);
    expect(total).toBe(flat.length);
  });

  it('does not split a shape whose only large steps are corner arcs', () => {
    // a sharp star at a large offset has long arc chords; they must not read as gaps
    expect(offsetPolygonToLoops(star(5, 140, 20), 25, { arcSegments: 4 })).toHaveLength(1);
  });

  it('returns an empty array when nothing survives the offset', () => {
    expect(offsetPolygonToLoops(square, -400)).toEqual([]);
  });
});
