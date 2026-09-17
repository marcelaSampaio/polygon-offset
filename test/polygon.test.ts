import { describe, it, expect } from 'vitest';
import {
  signedArea, area, perimeter, toPositiveOrientation, isNegativelyOriented,
  pointInPolygon, distanceToPolygon, distanceToSegment, isSelfIntersecting,
} from '../src';
import { pt, square, lBend, star, regularPolygon } from './fixtures';

describe('signedArea', () => {
  it('measures the area of a square', () => {
    expect(area(square)).toBe(10_000);
  });

  it('flips sign with winding, keeps magnitude', () => {
    const reversed = [...square].reverse();
    expect(signedArea(reversed)).toBe(-signedArea(square));
  });

  it('converges on pi r^2 as a polygon approaches a circle', () => {
    expect(area(regularPolygon(2000, 10))).toBeCloseTo(Math.PI * 100, 2);
  });

  it('is zero for degenerate input', () => {
    expect(signedArea([pt(0, 0), pt(1, 1)])).toBe(0);
    expect(signedArea([])).toBe(0);
  });
});

describe('orientation', () => {
  it('normalises winding without changing the shape', () => {
    const reversed = [...square].reverse();
    expect(isNegativelyOriented(reversed)).toBe(true);
    expect(signedArea(toPositiveOrientation(reversed))).toBeGreaterThan(0);
    expect(toPositiveOrientation(reversed)).toHaveLength(square.length);
  });

  it('leaves an already-positive polygon alone', () => {
    expect(toPositiveOrientation(square)).toEqual(square);
  });
});

describe('perimeter', () => {
  it('sums the closing edge too', () => {
    expect(perimeter(square)).toBe(400);
  });
});

describe('pointInPolygon', () => {
  it('handles the obvious cases', () => {
    expect(pointInPolygon(pt(50, 50), square)).toBe(true);
    expect(pointInPolygon(pt(150, 50), square)).toBe(false);
  });

  it('excludes the notch of a concave polygon', () => {
    // inside the bounding box of the L, but in the cut-away corner
    expect(pointInPolygon(pt(100, 100), lBend)).toBe(false);
    expect(pointInPolygon(pt(20, 20), lBend)).toBe(true);
  });

  it('is unaffected by winding direction', () => {
    const reversed = [...lBend].reverse();
    expect(pointInPolygon(pt(20, 20), reversed)).toBe(true);
    expect(pointInPolygon(pt(100, 100), reversed)).toBe(false);
  });

  it('puts the centre of a star inside, an arm tip inside, and the valley between arms outside', () => {
    const s = star(5, 120, 48);
    expect(pointInPolygon(pt(0, 0), s)).toBe(true);
    // the first arm points straight up the -y axis, so this is inside it
    expect(pointInPolygon(pt(0, -110), s)).toBe(true);
    // one tenth of a turn round is a valley: at r=110 that is well outside
    const a = (1 / 10) * Math.PI * 2 - Math.PI / 2;
    expect(pointInPolygon(pt(Math.cos(a) * 110, Math.sin(a) * 110), s)).toBe(false);
  });
});

describe('distance', () => {
  it('clamps to the segment ends rather than the infinite line', () => {
    expect(distanceToSegment(pt(-10, 0), pt(0, 0), pt(10, 0))).toBe(10);
    expect(distanceToSegment(pt(5, 3), pt(0, 0), pt(10, 0))).toBe(3);
  });

  it('survives a zero-length segment', () => {
    expect(distanceToSegment(pt(3, 4), pt(0, 0), pt(0, 0))).toBe(5);
  });

  it('measures to the boundary, from either side', () => {
    expect(distanceToPolygon(pt(50, 50), square)).toBe(50);
    expect(distanceToPolygon(pt(-10, 50), square)).toBe(10);
  });
});

describe('isSelfIntersecting', () => {
  it('is false for simple polygons', () => {
    expect(isSelfIntersecting(square)).toBe(false);
    expect(isSelfIntersecting(lBend)).toBe(false);
    expect(isSelfIntersecting(star())).toBe(false);
  });

  it('is true for a bow tie', () => {
    expect(isSelfIntersecting([pt(0, 0), pt(10, 10), pt(10, 0), pt(0, 10)])).toBe(true);
  });
});
