import type { Point } from './vec';
import { sub, add, scale, dot, cross } from './vec';

/**
 * Twice the signed area of a closed polygon, halved — positive for one winding
 * direction and negative for the other, in whatever coordinate system you use.
 *
 * Screen coordinates (y down) flip the sign relative to maths coordinates
 * (y up), which is why this library derives orientation from the polygon
 * itself instead of assuming one.
 */
export function signedArea(polygon: readonly Point[]): number {
  const n = polygon.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/** Absolute area, orientation-independent. */
export const area = (polygon: readonly Point[]): number => Math.abs(signedArea(polygon));

/** Perimeter of the closed polygon. */
export function perimeter(polygon: readonly Point[]): number {
  const n = polygon.length;
  if (n < 2) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += Math.hypot(
      polygon[(i + 1) % n].x - polygon[i].x,
      polygon[(i + 1) % n].y - polygon[i].y,
    );
  }
  return sum;
}

/** True when `signedArea` is negative. Meaningful only against your own axes. */
export const isNegativelyOriented = (polygon: readonly Point[]): boolean =>
  signedArea(polygon) < 0;

/** Returns a copy wound so that `signedArea` is positive. */
export function toPositiveOrientation(polygon: readonly Point[]): Point[] {
  return signedArea(polygon) < 0 ? [...polygon].reverse() : [...polygon];
}

/** Shortest distance from a point to a line segment. */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const ab = sub(b, a);
  const len2 = dot(ab, ab);
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = dot(sub(p, a), ab) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const proj = add(a, scale(ab, t));
  return Math.hypot(p.x - proj.x, p.y - proj.y);
}

/**
 * Shortest distance from a point to the polygon's boundary.
 * Always non-negative: it does not tell you which side you are on.
 */
export function distanceToPolygon(p: Point, polygon: readonly Point[]): number {
  const n = polygon.length;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const d = distanceToSegment(p, polygon[i], polygon[(i + 1) % n]);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Even-odd ray casting. Points exactly on the boundary are not guaranteed
 * either way — that is inherent to the test, not an oversight.
 */
export function pointInPolygon(p: Point, polygon: readonly Point[]): boolean {
  const n = polygon.length;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const straddles = a.y > p.y !== b.y > p.y;
    if (straddles && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** True when any two non-adjacent edges of the polygon cross. */
export function isSelfIntersecting(polygon: readonly Point[]): boolean {
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      if (
        segmentsIntersect(
          polygon[i],
          polygon[(i + 1) % n],
          polygon[j],
          polygon[(j + 1) % n],
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = cross(sub(p2, p1), sub(p3, p1));
  const d2 = cross(sub(p2, p1), sub(p4, p1));
  const d3 = cross(sub(p4, p3), sub(p1, p3));
  const d4 = cross(sub(p4, p3), sub(p2, p3));
  return d1 * d2 < 0 && d3 * d4 < 0;
}
