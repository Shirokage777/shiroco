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

  // Walk round the four edges (top, right, bottom, left), each point torn inward by its depth.
  const steps = Math.max(1, Math.round(perimeter / STEP));
  const walk = Array.from({ length: steps }, (_, k) => {
    const t = (k / steps) * perimeter;
    const edge = t < w ? 0 : t < w + h ? 1 : t < 2 * w + h ? 2 : 3;
    return { edge, along: t - [0, w, w + h, 2 * w + h][edge], d: depth(t) };
  });
  // At a corner, an edge must stay clear of its neighbour's tear: points closer to the corner than
  // the neighbouring edge is torn anywhere near it are left out, so the corner is one straight cut
  // from edge to edge. Otherwise the outline crosses itself and leaves stray triangles there.
  const length = [w, h, w, h];
  const NEAR = DEPTH + STEP;
  const deepest = (e: number, from: number, to: number) =>
    Math.max(0, ...walk.filter((p) => p.edge === e && p.along >= from && p.along <= to).map((p) => p.d));
  const atStart = [0, 1, 2, 3].map((e) => deepest(e, 0, NEAR));
  const atEnd = [0, 1, 2, 3].map((e) => deepest(e, length[e] - NEAR, length[e]));
  return walk
    .filter(({ edge, along }) => along >= atEnd[(edge + 3) % 4] && along <= length[edge] - atStart[(edge + 1) % 4])
    .map(({ edge, along: s, d }): [number, number] => {
      if (edge === 0) return [s, d];
      if (edge === 1) return [w - d, s];
      if (edge === 2) return [w - s, h - d];
      return [d, h - s];
    });
}

export function tornClipPath(w: number, h: number, seed = 1): string {
  return `polygon(${tornOutline(w, h, seed)
    .map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`)
    .join(",")})`;
}
