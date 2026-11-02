import { describe, expect, it } from "vitest";
import { tornClipPath, tornOutline } from "@/app/torn-edge";

describe("torn paper outline", () => {
  it("stays inside the note and goes all the way round", () => {
    const points = tornOutline(600, 1400);
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(600);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1400);
    }
    // Every edge is torn, but never deeper than a thin strip.
    const near = (v: number, edge: number) => Math.abs(v - edge) <= 13;
    expect(points.some(([, y]) => near(y, 0))).toBe(true);
    expect(points.some(([x]) => near(x, 600))).toBe(true);
    expect(points.some(([, y]) => near(y, 1400))).toBe(true);
    expect(points.some(([x]) => near(x, 0))).toBe(true);
  });

  it("never crosses itself, so no stray triangles at the corners, whatever the note size", () => {
    type P = [number, number];
    const side = (p: P, q: P, r: P) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    const cross = (a: P, b: P, c: P, d: P) => side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
    for (let w = 280; w <= 620; w += 37) {
      for (const h of [80, 130, 220, 480, 900, 1400]) {
        const p = tornOutline(w, h);
        const crossings: string[] = [];
        for (let i = 0; i < p.length; i++) {
          for (let j = i + 2; j < p.length; j++) {
            if (i === 0 && j === p.length - 1) continue; // neighbours round the wrap
            if (cross(p[i], p[(i + 1) % p.length], p[j], p[(j + 1) % p.length])) crossings.push(`${p[i]} / ${p[j]}`);
          }
        }
        expect(crossings, `${w}x${h}`).toEqual([]);
      }
    }
  });

  it("is the same every time for the same size, so notes do not flicker", () => {
    expect(tornClipPath(320, 140)).toBe(tornClipPath(320, 140));
  });

  it("is quick enough to work out for the biggest card", () => {
    const start = performance.now();
    for (let i = 0; i < 20; i++) tornClipPath(600, 1600, i);
    expect((performance.now() - start) / 20).toBeLessThan(5);
  });
});
