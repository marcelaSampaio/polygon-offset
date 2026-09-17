import type { Point } from '../src';

export const pt = (x: number, y: number): Point => ({ x, y });

export const square: Point[] = [pt(0, 0), pt(100, 0), pt(100, 100), pt(0, 100)];

/** One reflex corner. */
export const lBend: Point[] = [
  pt(0, 0), pt(120, 0), pt(120, 50), pt(50, 50), pt(50, 140), pt(0, 140),
];

/** Alternating sharp convex and reflex corners — where bisector offset breaks. */
export function star(points = 5, outer = 120, inner = 48): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    out.push(pt(Math.cos(a) * r, Math.sin(a) * r));
  }
  return out;
}

/** A narrow waist: shrinking far enough must split it into two loops. */
export const neck: Point[] = [
  pt(0, 0), pt(100, 0), pt(100, 70), pt(58, 92), pt(58, 108), pt(100, 130),
  pt(100, 200), pt(0, 200), pt(0, 130), pt(42, 108), pt(42, 92), pt(0, 70),
];

export const regularPolygon = (sides: number, radius = 100): Point[] =>
  Array.from({ length: sides }, (_, i) => {
    const a = (i / sides) * Math.PI * 2;
    return pt(Math.cos(a) * radius, Math.sin(a) * radius);
  });
