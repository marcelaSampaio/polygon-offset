/** A point (or vector) in the plane. All library input and output uses this shape. */
export interface Point {
  x: number;
  y: number;
}

export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });

export const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;

/** 2D cross product (the z of the 3D cross). Sign gives the turn direction. */
export const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x;

export const length = (a: Point): number => Math.hypot(a.x, a.y);

/** Unit vector. A zero-length input returns {x:0,y:0} rather than NaN. */
export function normalize(a: Point): Point {
  const l = Math.hypot(a.x, a.y);
  return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

/** Right-hand normal of a direction vector. */
export const normal = (d: Point): Point => ({ x: d.y, y: -d.x });

/**
 * Intersection of two infinite lines, each given as a point and a direction.
 * Returns null when the directions are parallel within `epsilon`.
 */
export function lineIntersection(
  p1: Point,
  d1: Point,
  p2: Point,
  d2: Point,
  epsilon = 1e-9,
): Point | null {
  const den = cross(d1, d2);
  if (Math.abs(den) < epsilon) return null;
  const t = cross(sub(p2, p1), d2) / den;
  return { x: p1.x + d1.x * t, y: p1.y + d1.y * t };
}
