# polygon-offset

Offsetting a polygon so that every point of the result is **actually** at the distance you asked for — and the function that proves it.

TypeScript, zero dependencies, ESM + CJS. 2.3 kB gzipped.

**[▶ Interactive demo](https://marcelasampaio.github.io/polygon-offset/)** — drag the vertices, watch the error readout.

> Published as **`polygon-offset-exact`**; the unscoped `polygon-offset` was already taken. The `-exact` is the point of the library, so it earns its place.

```bash
npm install polygon-offset-exact
```

```ts
import { offsetPolygon, maxDeviation } from 'polygon-offset-exact';

const piece = [{x:0,y:0}, {x:100,y:0}, {x:100,y:60}, {x:40,y:60}, {x:40,y:140}, {x:0,y:140}];

const cutLine = offsetPolygon(piece, 10);        // seam allowance, 10 units out
maxDeviation(cutLine, piece, 10);                // 1.4e-14 — machine precision
```

---

## Why this exists

The intuitive way to offset a polygon is to push every vertex outward along its angle bisector. It is the first thing you would write. It is wrong, and it is wrong in a way that is easy to miss.

Bisector displacement puts a vertex at `d / sin(θ/2)` from the corner, not at `d`. As a corner sharpens, `θ → 0` and the error runs away. On a five-pointed star offset by 40, the worst point of the naive result lands **121.8 units** from the source polygon instead of 40 — off by 205%.

The usual complaint about naive offsetting is that it self-intersects. On most real shapes it doesn't. It just lands in the wrong place, silently, and looks fine. In CAD, cutting or CNC that distance *is* the point: it's the seam allowance, the tool radius, the kerf. A part cut from a curve that is three times too far out is scrap.

This library ships the naive version too — as `naiveOffsetPolygon`, so you can measure the gap yourself:

```ts
import { offsetPolygon, naiveOffsetPolygon, maxDeviation } from 'polygon-offset-exact';

maxDeviation(naiveOffsetPolygon(star, 40), star, 40);  // 81.8
maxDeviation(offsetPolygon(star, 40), star, 40);       // 2.8e-14
```

## How it works

1. **Offset every edge along its own normal.** Each edge now lies at exactly `d` from the source — true by construction, not by hope. No bisectors anywhere.
2. **Rejoin the corners.** A convex corner leaves a wedge, filled with an arc of radius `d` centred on the original vertex. A reflex corner makes the two offset edges overrun each other, so they are trimmed to their intersection — with a miter limit, so a near-degenerate corner cannot throw a spike toward infinity.
3. **Sample, then filter by true distance.** Each edge is sampled, and any sample whose real distance to the source polygon isn't `d` is dropped. This is what handles the topology change when the offset eats a narrow feature: a waist pinched shut simply stops producing points there.

Step 3 is why the default tolerance is an epsilon rather than a percentage. Every constructed point is on the band by construction except the mitre points, and those are exactly the ones that need checking.

## API

### `offsetPolygon(polygon, distance, options?): Point[]`

Positive `distance` grows the polygon, negative shrinks it. Orientation is read from the input's signed area, so screen coordinates (y down) and maths coordinates (y up) both behave the way you expect — no winding convention to remember.

Returns a **dense point list**, not a vertex list: straight runs are sampled and corners are arcs, because the guarantee is about distance, not about vertex count.

| option | default | |
|---|---|---|
| `arcSegments` | `16` | segments per convex corner |
| `miterLimit` | `8` | max trim at a reflex corner, as a multiple of `|distance|` |
| `sampleStep` | `|distance| / 12` | spacing between samples, in input units |
| `tolerance` | `|distance| * 1e-9` | how far off the band a point may be and still be kept |

### `offsetPolygonToLoops(polygon, distance, options?): Point[][]`

The same offset, split into separate closed loops. When an inward offset pinches a waist shut, the outline becomes two loops and a flat list can't say where one ends. Splits on spacing (a heuristic, documented as one — not a topological reconstruction), which covers the ordinary cases: necks, slots, thin tabs.

### `maxDeviation(result, polygon, distance): number`

The largest distance error in a result. **Shipped as part of the API on purpose** — a picture can't tell you an offset is correct, because a result that's wrong by a few units still looks like an offset. Check the output, don't trust it.

### Also exported

Small, dependency-free primitives the offsetting is built on, useful on their own:

`signedArea` · `area` · `perimeter` · `toPositiveOrientation` · `isNegativelyOriented` · `pointInPolygon` · `distanceToPolygon` · `distanceToSegment` · `isSelfIntersecting` · `naiveOffsetPolygon`

and the vector helpers `add` `sub` `scale` `dot` `cross` `length` `normalize` `normal` `lineIntersection`.

## What it does not do

Being honest about the edges, since the whole point of the library is not lying about distances:

- **Simple polygons only.** One closed ring, no holes, no self-intersections in the input.
- **No curve fitting.** The output is a polyline. Arcs come out as arc *segments*; nothing is reconstructed into arcs or béziers.
- **Loop splitting is a spacing heuristic.** Loops that end up closer together than `splitGap` will not be separated.
- **No winding correction on output.** If you need a specific orientation, run `toPositiveOrientation` on the result.

## Tests

57 tests. The core of the suite is one property, asserted across a square, an L-bend, a star, a narrow neck and a near-circle, at positive and negative distances: *every returned point is at `|distance|` from the source, to within 1e-6.* Plus the degenerate cases — a sliver triangle, a two-point input, an offset larger than the shape.

```bash
npm test
npm run typecheck
```

MIT licensed. Built by [Marcela Sampaio](https://marcela-sampaio.pages.dev).
