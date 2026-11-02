// The torn, frayed outline of a paper note as a clip-path polygon.
//
// It replaces a live SVG noise filter, which Safari works out on the CPU over the whole
// sheet and redid on every repaint and while scrolling. The outline is worked out once per
// note size in a few hundred microseconds; clipping to it costs the browser next to nothing.
//
// The edge wanders inward by up to DEPTH px: smooth fractal noise (three octaves, like the
// old filter's) for the tears, plus a little jitter for the fibres.

const DEPTH = 13; // deepest tear, px
const STEP = 4; // spacing of the outline points along the edge, px
const WAVE = 46; // length of the largest tears, px

// Seeded random, so a note of the same size always gets the same outline.
function random(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

// 1D value noise: random values at every `wave` px, eased between.
function octave(length: number, wave: number, rand: () => number) {
  const knots = Array.from({ length: Math.ceil(length / wave) + 2 }, rand);
  return (t: number) => {
    const i = Math.floor(t / wave);
    const f = t / wave - i;
    const e = f * f * (3 - 2 * f);
    return knots[i] + (knots[i + 1] - knots[i]) * e;
  };
}

// Points of the outline, clockwise from the top left, in px inside a w × h box.
export function tornOutline(w: number, h: number, seed = 1): [number, number][] {
  const rand = random(seed * 7919 + Math.round(w) * 31 + Math.round(h));
  const perimeter = 2 * (w + h);
  const octaves = [
    { o: octave(perimeter, WAVE, rand), weight: 0.57 },
    { o: octave(perimeter, WAVE / 2, rand), weight: 0.29 },
    { o: octave(perimeter, WAVE / 4, rand), weight: 0.14 },
  ];
  // The noise wraps round the corner of the start, so the outline closes without a step.
  const depth = (t: number) => {
    const n = octaves.reduce((sum, { o, weight }) => sum + o(t) * weight, 0);
    const blend = Math.min(1, (perimeter - t) / WAVE);
    const start = octaves.reduce((sum, { o, weight }) => sum + o(0) * weight, 0);
    const smooth = n * blend + start * (1 - blend);
    return Math.max(0, Math.min(DEPTH, (smooth - 0.18) * DEPTH * 1.5 + (rand() - 0.5) * 1.6));
  };

  const points: [number, number][] = [];
  const steps = Math.max(1, Math.round(perimeter / STEP));
  for (let k = 0; k < steps; k++) {
    const t = (k / steps) * perimeter;
    const d = depth(t);
    if (t < w) points.push([t, d]);
    else if (t < w + h) points.push([w - d, t - w]);
    else if (t < 2 * w + h) points.push([w - (t - w - h), h - d]);
    else points.push([d, h - (t - 2 * w - h)]);
  }
  return untangle(points);
}

type Point = [number, number];
const LOOP = 12; // points: the longest stray loop a corner can make

// Where a deep tear on one edge meets the next edge at a corner, the outline can run back over
// itself and leave a small stray triangle. Each such loop is cut off where the outline crosses
// itself; every other point stays exactly where it was.
function untangle(points: Point[]): Point[] {
  const p = [...points];
  for (let pass = 0; pass < 16; pass++) {
    const cut = findLoop(p);
    if (!cut) return p;
    const { i, j, at } = cut;
    const n = p.length;
    // Drop points i+1 .. j (round the wrap if need be) and put the crossing point in their place.
    const drop = new Set(Array.from({ length: (j - i + n) % n }, (_, k) => (i + 1 + k) % n));
    const kept = p.filter((_, k) => !drop.has(k));
    const insertAt = kept.indexOf(p[i]) + 1;
    kept.splice(insertAt, 0, at);
    p.splice(0, p.length, ...kept);
  }
  return p;
}

function findLoop(p: Point[]): { i: number; j: number; at: Point } | null {
  const n = p.length;
  for (let i = 0; i < n; i++) {
    for (let k = 2; k <= LOOP && k < n - 1; k++) {
      const j = (i + k) % n;
      const at = crossing(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n]);
      if (at) return { i, j, at };
    }
  }
  return null;
}

// Where segments ab and cd cross (not just touch), or null.
function crossing(a: Point, b: Point, c: Point, d: Point): Point | null {
  const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
  if (den === 0) return null;
  const s = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den;
  const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den;
  if (s <= 1e-9 || s >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) return null;
  return [a[0] + s * (b[0] - a[0]), a[1] + s * (b[1] - a[1])];
}

export function tornClipPath(w: number, h: number, seed = 1): string {
  return `polygon(${tornOutline(w, h, seed)
    .map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`)
    .join(",")})`;
}
