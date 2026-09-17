import type { Point } from './vec';
import { add, scale, sub, cross, normalize, normal, length, lineIntersection } from './vec';
import { signedArea, distanceToPolygon } from './polygon';

export interface OffsetOptions {
  /** Segments used to fill each convex corner with an arc. Default 16. */
  arcSegments?: number;
  /**
   * How far a reflex corner may be trimmed, as a multiple of |distance|,
   * before the corner is left open instead of mitred to a spike. Default 8.
   */
  miterLimit?: number;
  /**
   * Distance between samples along each offset edge, in input units.
   * Default |distance| / 12, floored at 1e-6. Smaller means a finer result
   * and a slower call.
   */
  sampleStep?: number;
  /**
   * A sample is kept when its true distance to the source polygon is within
   * this band of |distance|. Default `|distance| * 1e-9`, i.e. exact.
   *
   * Edge samples and corner arcs sit on the band by construction; the only
   * points that can miss it are the mitre points where two reflex edges were
   * trimmed to their intersection, and the samples that a shrinking offset
   * has eaten. An exact default drops both, which is what makes the topology
   * change correctly when the offset exceeds the local feature size.
   *
   * Raise it if you would rather keep a slightly-off corner than have a gap.
   */
  tolerance?: number;
}

const DEFAULTS = { arcSegments: 16, miterLimit: 8 };

/**
 * Offset a simple closed polygon by `distance`.
 *
 * Positive distance grows the polygon, negative shrinks it, in the polygon's
 * own winding — orientation is read from the input, so screen coordinates
 * (y down) and maths coordinates (y up) both behave the way you expect.
 *
 * The result is a dense point list, not a vertex list: straight runs are
 * sampled and corners are arcs, because the guarantee this function makes is
 * about distance, not about vertex count. Verify it with `maxDeviation`.
 *
 * Why not move each vertex along its angle bisector: that displaces a vertex
 * to `distance / sin(θ/2)` from the corner, not to `distance`, and the error
 * runs away as the corner sharpens. See the README.
 */
export function offsetPolygon(
  polygon: readonly Point[],
  distance: number,
  options: OffsetOptions = {},
): Point[] {
  const n = polygon.length;
  if (n < 3 || distance === 0) return polygon.map((p) => ({ ...p }));

  const arcSegments = Math.max(1, options.arcSegments ?? DEFAULTS.arcSegments);
  const miterLimit = options.miterLimit ?? DEFAULTS.miterLimit;
  const d = Math.abs(distance);
  const step = Math.max(options.sampleStep ?? d / 12, 1e-6);
  const tolerance = options.tolerance ?? Math.max(d * 1e-9, Number.EPSILON);

  // +1 when a positive `distance` should grow the polygon in these axes.
  const sign = (signedArea(polygon) > 0 ? 1 : -1) * Math.sign(distance);
  const maxMiter = d * miterLimit;

  // 1. Offset every edge along its OWN normal. Each edge now lies at exactly
  //    `d` from the source — that is true by construction, not by hope.
  interface Seg { a: Point; b: Point; dir: Point; nrm: Point; vertex: Point }
  const segs: Seg[] = [];
  for (let i = 0; i < n; i++) {
    const cur = polygon[i];
    const next = polygon[(i + 1) % n];
    const dir = normalize(sub(next, cur));
    const nrm = scale(normal(dir), sign);
    segs.push({
      a: add(cur, scale(nrm, d)),
      b: add(next, scale(nrm, d)),
      dir,
      nrm,
      vertex: next,
    });
  }

  // 2. Rejoin the gaps the offset opened at each corner.
  const joins: (Point[] | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const s1 = segs[i];
    const s2 = segs[(i + 1) % n];
    const turn = cross(s1.dir, s2.dir);
    if (Math.abs(turn) < 1e-12) continue; // collinear: nothing to join

    const convex = sign > 0 ? turn > 0 : turn < 0;
    if (convex) {
      // The two offset edges leave a wedge. Fill it with an arc of radius d
      // centred on the original vertex, so the join is also at distance d.
      const a0 = Math.atan2(s1.nrm.y, s1.nrm.x);
      const a1 = Math.atan2(s2.nrm.y, s2.nrm.x);
      let da = a1 - a0;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      const fan: Point[] = [];
      for (let k = 1; k <= arcSegments; k++) {
        const ang = a0 + (da * k) / arcSegments;
        fan.push({
          x: s1.vertex.x + Math.cos(ang) * d,
          y: s1.vertex.y + Math.sin(ang) * d,
        });
      }
      joins[i] = fan;
    } else {
      // The two offset edges overrun each other. Trim both to where they
      // cross, unless that point is absurdly far — a near-degenerate corner
      // would otherwise throw a spike towards infinity.
      const x = lineIntersection(s1.a, s1.dir, s2.a, s2.dir);
      if (x && length(sub(x, s1.vertex)) < maxMiter) {
        s1.b = x;
        s2.a = x;
        joins[i] = [];
      }
    }
  }

  // 3. Sample along each edge, so step 4 has something to filter.
  const sampled: Point[] = [];
  for (let i = 0; i < n; i++) {
    const s = segs[i];
    const edge = sub(s.b, s.a);
    const steps = Math.max(1, Math.ceil(length(edge) / step));
    for (let t = 0; t < steps; t++) sampled.push(add(s.a, scale(edge, t / steps)));
    sampled.push({ ...s.b });
    const join = joins[i];
    if (join && join.length) sampled.push(...join);
  }

  // 4. Drop everything that is not actually at `d` from the source. This is
  //    what handles the topology change when the offset eats a narrow feature.
  return sampled.filter((p) => Math.abs(distanceToPolygon(p, polygon) - d) <= tolerance);
}

/**
 * The largest distance error in an offset result: for every point, how far it
 * really is from the source polygon compared with the distance you asked for.
 *
 * This is the number that tells you whether an offset is correct. A picture
 * cannot: a result that is wrong by a few units still looks like an offset.
 * Shipped as part of the API on purpose — check the output, don't trust it.
 */
export function maxDeviation(
  result: readonly Point[],
  polygon: readonly Point[],
  distance: number,
): number {
  const d = Math.abs(distance);
  let worst = 0;
  for (const p of result) {
    const err = Math.abs(distanceToPolygon(p, polygon) - d);
    if (err > worst) worst = err;
  }
  return worst;
}

/**
 * The angle-bisector offset — the intuitive method, included so you can
 * measure how wrong it is with `maxDeviation`. Do not ship geometry built
 * with this.
 */
export function naiveOffsetPolygon(
  polygon: readonly Point[],
  distance: number,
): Point[] {
  const n = polygon.length;
  if (n < 3) return polygon.map((p) => ({ ...p }));
  const sign = (signedArea(polygon) > 0 ? 1 : -1) * Math.sign(distance);
  const d = Math.abs(distance);

  return polygon.map((cur, i) => {
    const prev = polygon[(i - 1 + n) % n];
    const next = polygon[(i + 1) % n];
    const n1 = scale(normal(normalize(sub(cur, prev))), sign);
    const n2 = scale(normal(normalize(sub(next, cur))), sign);
    const bis = normalize({ x: n1.x + n2.x, y: n1.y + n2.y });
    const cosHalf = Math.sqrt(Math.max(1e-6, (1 + (n1.x * n2.x + n1.y * n2.y)) / 2));
    return add(cur, scale(bis, d / cosHalf));
  });
}

/**
 * The same offset, split into separate closed loops.
 *
 * `offsetPolygon` returns one flat list of points. That is fine until the
 * offset eats a narrow feature and the outline has to change topology — a
 * waist pinched shut by an inward offset leaves two loops, and a flat list
 * cannot say where one ends and the next begins.
 *
 * This splits the result wherever consecutive samples jump further than any
 * legitimate step or corner arc could account for. It is a heuristic on
 * spacing, not a topological reconstruction: a shape whose loops end up
 * closer together than `splitGap` will not be separated. It is enough for
 * the ordinary cases — necks, slots, thin tabs — and it is honest about
 * what it is.
 *
 * Loops shorter than three points are dropped.
 */
export function offsetPolygonToLoops(
  polygon: readonly Point[],
  distance: number,
  options: OffsetOptions & { splitGap?: number } = {},
): Point[][] {
  const points = offsetPolygon(polygon, distance, options);
  if (points.length < 3) return points.length ? [points] : [];

  const d = Math.abs(distance);
  const arcSegments = Math.max(1, options.arcSegments ?? DEFAULTS.arcSegments);
  const step = Math.max(options.sampleStep ?? d / 12, 1e-6);
  const worstArcChord = 2 * d * Math.sin(Math.PI / arcSegments);
  const splitGap = options.splitGap ?? Math.max(step, worstArcChord) * 2.5;

  const loops: Point[][] = [];
  let current: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const gap = length(sub(points[i], points[i - 1]));
    if (gap > splitGap) {
      loops.push(current);
      current = [];
    }
    current.push(points[i]);
  }
  loops.push(current);

  // The list is cyclic: if the first and last runs are actually one loop that
  // the scan cut at the array boundary, join them back up.
  if (
    loops.length > 1 &&
    length(sub(loops[0][0], loops[loops.length - 1][loops[loops.length - 1].length - 1])) <= splitGap
  ) {
    loops[0] = [...loops.pop()!, ...loops[0]];
  }

  return loops.filter((l) => l.length >= 3);
}
