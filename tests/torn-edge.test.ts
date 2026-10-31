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

  it("is the same every time for the same size, so notes do not flicker", () => {
    expect(tornClipPath(320, 140)).toBe(tornClipPath(320, 140));
  });

  it("is quick enough to work out for the biggest card", () => {
    const start = performance.now();
    for (let i = 0; i < 20; i++) tornClipPath(600, 1600, i);
    expect((performance.now() - start) / 20).toBeLessThan(5);
  });
});
