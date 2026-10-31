// Generates public/bunker-wall.svg: the wall behind the notes, a basement of a bunker.
// Run: node scripts/make-wall.mjs   (the output is committed; this is only needed to change it)
//
// Grey concrete blocks of random sizes in staggered rows, set in recessed mortar. Grime
// gathers dark along every joint; the faces are pitted and grainy, a few corners are chipped
// and some blocks cracked, a few in webs, and water stains run down the whole wall. Over the
// wall run the fittings of a basement, unmaintained for decades: pipes in rusted sections with
// couplings, clamps and a valve,
// cable runs sagging between clips, a breaker panel, a junction box with conduit, a vent, a
// high-voltage warning sign and a sprayed level marking. A seeded random keeps the wall the
// same on every build. The tile wraps on all four sides, so it repeats without visible seams.
import { writeFileSync } from "node:fs";

const W = 1600;
const H = 1400;
const JOINT = 7; // mortar joint width

let seed = 20261031;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const between = (a, b) => a + rand() * (b - a);
const f = (n) => Math.round(n * 10) / 10;

const out = [];
const add = (s) => out.push(s);

// Block layout: the same staggered rows of random widths as before --------------------------
const rowHeights = [];
for (let y = 0; y < H - 340; ) {
  const h = Math.round(between(200, 330));
  rowHeights.push(h);
  y += h;
}
rowHeights.push(H - rowHeights.reduce((a, b) => a + b, 0)); // the last row closes the tile

const rows = [];
let top = 0;
for (const h of rowHeights) {
  const start = Math.round(between(-260, 0));
  const blocks = [];
  for (let x = start; x < start + W; ) {
    let w = Math.round(between(230, 560));
    if (x + w > start + W - 150) w = start + W - x; // last block meets the first one round the wrap
    blocks.push({ x, w, tone: Math.round(between(104, 122)), cracked: rand() < 0.3, chips: Math.floor(between(0, 3)) });
    x += w;
  }
  rows.push({ y: top, h, blocks });
  top += h;
}

const crackJobs = [];
const grey = (t) => `rgb(${t},${t - 2},${t - 6})`;

function block(x, y, w, h, b) {
  const g = JOINT / 2;
  const [bx, by, bw, bh] = [x + g, y + g, w - JOINT, h - JOINT];
  add(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="3" fill="${grey(b.tone)}"/>`);
  add(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="3" fill="url(#blockLight)"/>`);
  // Worn arrises: light catches the top edge, the bottom and right edges fall into shadow.
  add(`<rect x="${bx + 2}" y="${by}" width="${bw - 4}" height="2" fill="#fff" fill-opacity="0.09"/>`);
  add(`<rect x="${bx}" y="${by + bh - 3}" width="${bw}" height="3" fill="#000" fill-opacity="0.3"/>`);
  add(`<rect x="${bx + bw - 2}" y="${by}" width="2" height="${bh}" fill="#000" fill-opacity="0.22"/>`);
  // Chipped corners and edges, showing the rougher, darker core.
  for (let i = 0; i < b.chips; i++) {
    const cx = rand() < 0.5 ? bx + between(0, 30) : bx + bw - between(0, 30);
    const cy = rand() < 0.5 ? by : by + bh;
    const r = between(7, 16);
    const pts = Array.from({ length: 7 }, (_, k) => {
      const a = (k / 7) * Math.PI * 2;
      const d = r * between(0.5, 1);
      return `${f(cx + Math.cos(a) * d)},${f(cy + Math.sin(a) * d * 0.7)}`;
    });
    add(`<polygon points="${pts.join(" ")}" fill="#3b3935"/>`);
    add(`<polygon points="${pts.join(" ")}" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="1"/>`);
  }
  // Cracked blocks get their crack in a later pass (cracks below), drawn with a random of its
  // own. The draws the old single hairline made are still taken here, in the same order, so
  // every other part of the wall (grime, chips) stays exactly as it was.
  if (b.cracked) {
    between(0, 1);
    for (let cy = by; cy < by + bh * between(0.5, 1); cy += between(10, 24)) between(-14, 14);
    crackJobs.push({ bx, by, bw, bh, seed: Math.abs(Math.round(b.x * 131 + y * 17)) + 1 });
  }
  // Grime collects along the joints: a patchy, blurred dark border over the block's edge.
  add(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="none" stroke="#0b0907" stroke-width="${f(between(26, 40))}" stroke-opacity="${f(between(0.75, 0.95))}" filter="url(#edgeGrime)"/>`);
}

// Mortar: darker, rough and recessed, so it reads as the shadowed joint between the blocks.
add(`<rect width="${W}" height="${H}" fill="#3a3834"/>`);
add(`<rect width="${W}" height="${H}" filter="url(#mortar)"/>`);
// Each block is drawn three times, shifted by the tile width, so the rows wrap seamlessly.
for (const row of rows) for (const b of row.blocks) for (const dx of [-W, 0, W]) block(b.x + dx, row.y, b.w, row.h, b);

// Cracks ---------------------------------------------------------------------------------
// Real cracks in concrete wander in short jagged steps, narrow towards their ends, fork, and
// hold dirt: each is drawn as a dark core over a soft halo of grime, with a faint lit lip on
// its lower side. Where something struck or settled, cracks spread as a web from a spalled
// point, the radial cracks linked by shorter rings.
function crackRandom(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

// One branch from (x, y) heading at angle `a`; returns its points. Forks spawn new branches.
function crackBranch(r, x, y, a, len, width, out, depth = 0) {
  const pts = [[x, y]];
  let drift = (r() - 0.5) * 0.08;
  for (let walked = 0; walked < len; ) {
    const step = 5 + r() * 10;
    a += drift + (r() - 0.5) * (r() < 0.15 ? 1.1 : 0.3);
    drift += (r() - 0.5) * 0.02;
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    walked += step;
    pts.push([x, y]);
    if (depth < 2 && r() < 0.03 * (2 - depth)) {
      const side = r() < 0.5 ? -1 : 1;
      crackBranch(r, x, y, a + side * (0.35 + r() * 0.8), (len - walked) * (0.25 + r() * 0.5), width * 0.55, out, depth + 1);
    }
  }
  out.push({ pts, width });
}

// Collects branches as three tapering stretches; the dark halo and the lit lip are added to
// all of them at once by the crackFx filter, so each crack is stored only once.
const crackPaths = [];
function drawCracks(branches) {
  for (const { pts, width } of branches) {
    const n = pts.length;
    for (let k = 0; k < 3; k++) {
      const part = pts.slice(Math.floor((k * (n - 1)) / 3), Math.floor(((k + 1) * (n - 1)) / 3) + 1);
      if (part.length > 1) crackPaths.push({ d: "M" + part.map(([px, py]) => `${Math.round(px)},${Math.round(py)}`).join("L"), w: Math.max(0.35, width * (1 - k * 0.33)) });
    }
  }
}

function crackWeb(r, cx, cy, size) {
  const branches = [];
  const arms = 6 + Math.floor(r() * 4);
  const angles = Array.from({ length: arms }, (_, i) => ((i + r() * 0.6) / arms) * Math.PI * 2).sort((p, q) => p - q);
  const ends = angles.map((a) => {
    const before = branches.length;
    crackBranch(r, cx, cy, a, size * (0.45 + r() * 0.75), 1.3 + r() * 1.1, branches, 1);
    return branches[branches.length - 1] ?? branches[before];
  });
  // Rings: short jagged links between neighbouring arms.
  for (const ring of [0.25 + r() * 0.12, 0.5 + r() * 0.15]) {
    for (let i = 0; i < arms; i++) {
      if (r() < 0.3) continue;
      const pa = ends[i].pts;
      const pb = ends[(i + 1) % arms].pts;
      const A = pa[Math.min(pa.length - 1, Math.floor(pa.length * ring))];
      const B = pb[Math.min(pb.length - 1, Math.floor(pb.length * ring))];
      const pts = [A];
      for (let k = 1; k < 4; k++) pts.push([A[0] + ((B[0] - A[0]) * k) / 4 + (r() - 0.5) * 6, A[1] + ((B[1] - A[1]) * k) / 4 + (r() - 0.5) * 6]);
      pts.push(B);
      branches.push({ pts, width: 0.7 + r() * 0.5 });
    }
  }
  drawCracks(branches);
  // The spalled point: a shallow pit where the surface broke away.
  const pit = Array.from({ length: 9 }, (_, k) => {
    const a = (k / 9) * Math.PI * 2;
    const d = size * 0.07 * (0.6 + r() * 0.7);
    return `${f(cx + Math.cos(a) * d)},${f(cy + Math.sin(a) * d)}`;
  }).join(" ");
  add(`<polygon points="${pit}" fill="#2c2a27"/>`);
  add(`<polygon points="${pit}" fill="none" stroke="#000" stroke-opacity="0.5" stroke-width="1.2"/>`);
  add(`<polygon points="${pit}" fill="none" stroke="#d6d2c8" stroke-opacity="0.08" stroke-width="1" transform="translate(0.8 1.2)"/>`);
}

// A crack across each cracked block, from an edge, sometimes reaching another. Copies of
// blocks that lie wholly outside the tile are skipped.
for (const { bx, by, bw, bh, seed: s } of crackJobs) {
  if (bx > W || bx + bw < 0) continue;
  const r = crackRandom(s);
  const branches = [];
  const fromTop = r() < 0.6;
  const x = bx + bw * (0.15 + r() * 0.7);
  crackBranch(r, x, fromTop ? by : by + bh, fromTop ? Math.PI / 2 + (r() - 0.5) * 0.8 : -Math.PI / 2 + (r() - 0.5) * 0.8, bh * (0.5 + r() * 0.6), 1.2 + r() * 1.2, branches);
  drawCracks(branches);
}
// Webs where the wall took a blow or settled under a load.
for (const [cx, cy, size, s] of [[380, 150, 150, 11], [980, 1120, 120, 23], [150, 1080, 95, 37], [1450, 520, 80, 41]]) {
  for (const dx of [-W, 0, W]) if (cx + dx + size * 1.3 > 0 && cx + dx - size * 1.3 < W) crackWeb(crackRandom(s), cx + dx, cy, size);
}
add(`<g filter="url(#crackFx)" fill="none" stroke="#080706" stroke-opacity="0.9" stroke-linecap="round" stroke-linejoin="round">`);
for (const { d, w } of crackPaths) add(`<path d="${d}" stroke-width="${f(w)}"/>`);
add(`</g>`);

// Concrete surface and dirt over the whole wall -------------------------------------------------
add(`<rect width="${W}" height="${H}" filter="url(#mottle)" opacity="0.12"/>`);
add(`<rect width="${W}" height="${H}" filter="url(#pores)"/>`);
add(`<rect width="${W}" height="${H}" filter="url(#grain)"/>`);
add(`<rect width="${W}" height="${H}" filter="url(#grime)"/>`);
add(`<rect width="${W}" height="${H}" filter="url(#streaks)" opacity="0.8"/>`);

// Fittings ---------------------------------------------------------------------------------
// Decades without maintenance, but steel that was made to last: the rust is sporadic, small
// spots mostly where two pieces of metal meet (couplings, clamps, bolts, hinges) or water
// hangs, now and then running down the wall below. The fittings
// use their own random, and each rust overlay one of several noise filters (rust0..rust7) at
// its own strength, so no two stretches of pipe weather alike.
let fseed = 777;
const frand = () => ((fseed = (fseed * 16807) % 2147483647) - 1) / 2147483646;
const fb = (a, b) => a + frand() * (b - a);
const RUSTS = 8;
const rustF = () => `rust${Math.floor(frand() * RUSTS)}`;
// An overlay laid over a shape: the same shape, filled by a filter that is cut to it.
const over = (shape, filter, opacity = 1) => add(shape.replace("/>", ` fill="#000" filter="url(#${filter})" opacity="${f(opacity)}"/>`));

const drip = (x, y, len, rusty, width = fb(2, 6)) =>
  add(`<rect x="${f(x)}" y="${f(y)}" width="${f(width)}" height="${f(len)}" fill="url(#${rusty ? "dripRust" : "dripDark"})" filter="url(#softer)"/>`);
// Rust bleeding down the wall from a point: one wide faint stain and a few thin runs.
function bleed(x, y, strength = 1) {
  add(`<rect x="${f(x - fb(5, 10))}" y="${f(y)}" width="${f(fb(10, 20))}" height="${f(fb(60, 180) * strength)}" fill="url(#dripRust)" opacity="${f(fb(0.35, 0.7))}" filter="url(#soft)"/>`);
  for (let i = 0, n = Math.floor(fb(1, 4)); i < n; i++) drip(x + fb(-7, 7), y, fb(30, 200) * strength, frand() < 0.75, fb(1.5, 4));
}
// A rust bloom: an irregular patch of thick rust, swelling out of a joint or bolt.
const bloom = (cx, cy, rx, ry) => add(`<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="#000" filter="url(#bloom${Math.floor(frand() * 3)})" opacity="${f(fb(0.6, 1))}"/>`);
// Spots of dirt: blotches of different size and darkness, never an even coat.
function spots(x, y, w, h, n) {
  for (let i = 0; i < n; i++) {
    const rx = fb(5, 32);
    add(`<ellipse cx="${f(x + fb(0, w))}" cy="${f(y + fb(0, h))}" rx="${f(rx)}" ry="${f(rx * fb(0.4, 1))}" fill="#120e0a" opacity="${f(fb(0.3, 0.75))}" filter="url(#blotch${Math.floor(frand() * 3)})"/>`);
  }
}
// Bolts: most rusted, some seized dark, now and then one gone with only its hole left.
function bolt(x, y, wall = true) {
  const r = frand();
  if (r < 0.07) {
    add(`<circle cx="${f(x)}" cy="${f(y)}" r="2.2" fill="#080706"/>`);
    if (wall) bleed(x, y + 2, 0.5);
    return;
  }
  add(`<use href="#${r < 0.35 ? "boltRust" : "bolt"}" x="${f(x)}" y="${f(y)}" transform="rotate(${f(fb(0, 90))} ${f(x)} ${f(y)})"/>`);
  if (r < 0.2) bloom(x + 1, y + 2, fb(3, 6), fb(3, 5));
  if (wall && frand() < 0.2) bleed(x, y + 3, 0.5);
}

// The surface of a pipe, worn like the metal buttons: patches of grime and pits with no
// direction to them, and random scratches, light where they cut through the dirt to the
// metal and dark where they hold it.
function pipeSurface(vertical, at, d, from, to) {
  const shape = vertical ? `<rect x="${at}" y="${from}" width="${d}" height="${to - from}"/>` : `<rect x="${from}" y="${at}" width="${to - from}" height="${d}"/>`;
  over(shape, "pipePatches", 0.95);
  over(shape, "pipePits", 1);
  const clampTo = (v) => Math.min(at + d - 1.5, Math.max(at + 1.5, v));
  for (let i = 0, n = Math.round((to - from) / 22); i < n; i++) {
    const p = fb(from, to);
    const q = fb(at + 2, at + d - 2);
    const len = fb(3, Math.min(28, d * 1.4));
    const ang = fb(0, Math.PI);
    const [dp, dq] = [Math.cos(ang) * len, Math.sin(ang) * len * 0.6];
    const light = frand() < 0.7;
    const [x1, y1, x2, y2] = vertical ? [clampTo(q), p, clampTo(q + dq), p + dp] : [p, clampTo(q), p + dp, clampTo(q + dq)];
    add(`<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${light ? "#e6e1d6" : "#0c0a08"}" stroke-opacity="${f(light ? fb(0.08, 0.22) : fb(0.12, 0.25))}" stroke-width="${f(fb(0.5, 1.1))}" stroke-linecap="round"/>`);
  }
}

// A pipe run: sections joined by couplings at irregular spacing, each section weathered on
// its own. A coupling sits on the tile's edge, so the run repeats round the wrap unseen.
function pipe({ vertical = false, at, d, from = 0, to = vertical ? H : W, wrap = false }) {
  const len = to - from;
  const rect = (a, b, extra = 0) =>
    vertical ? `<rect x="${at - extra}" y="${f(a)}" width="${d + 2 * extra}" height="${f(b - a)}"/>` : `<rect x="${f(a)}" y="${at - extra}" width="${f(b - a)}" height="${d + 2 * extra}"/>`;
  // Shadow on the wall, the pipe itself, then its surface.
  add((vertical ? `<rect x="${at + d * 0.5}" y="${from}" width="${d}" height="${len}"` : `<rect x="${from}" y="${at + d * 0.6}" width="${len}" height="${d}"`) + ` fill="#000" fill-opacity="0.6" filter="url(#shadow)"/>`);
  add(rect(from, to).replace("/>", ` fill="url(#${vertical ? "pipeV" : "pipeH"})"/>`));
  pipeSurface(vertical, at, d, from, to);
  // Couplings: irregular spacing, one on the wrap edge for full runs.
  const joints = wrap ? [from] : [];
  for (let p = from + fb(140, 380); p < to - 60; p += fb(260, 560)) joints.push(p);
  const bounds = [from, ...joints.filter((j) => j > from), to];
  // Each section: its own tone.
  for (let i = 0; i < bounds.length - 1; i++) {
    const [a, b] = [bounds[i], bounds[i + 1]];
    add(rect(a, b).replace("/>", ` fill="${frand() < 0.5 ? "#000" : "#fff"}" opacity="${f(fb(0, 0.12))}"/>`));
    // No coat of rust: now and then a small patch, mostly on the underside where water hangs.
    for (let k = 0, n = frand() < 0.5 ? 0 : Math.floor(fb(1, 3)); k < n; k++) {
      const p = fb(a + 10, b - 10);
      const q = fb(0.55, 0.95) * d;
      bloom(vertical ? at + q : p, vertical ? p : at + q, fb(4, 12), fb(2, 5));
    }
    // A broken specular line: what is left of the metal's shine.
    const shine = vertical ? `<rect x="${at + d * 0.3}" y="${f(a)}" width="${f(Math.max(1.5, d * 0.08))}" height="${f(b - a)}"/>` : `<rect x="${f(a)}" y="${at + d * 0.3}" width="${f(b - a)}" height="${f(Math.max(1.5, d * 0.08))}"/>`;
    add(shine.replace("/>", ` fill="#d8d2c4" opacity="${f(fb(0.12, 0.28))}" filter="url(#broken)"/>`));
    // Dust settles along the top of horizontal pipes.
    if (!vertical) add(`<rect x="${f(a)}" y="${at}" width="${f(b - a)}" height="${f(d * 0.18)}" fill="#8a7f6c" opacity="${f(fb(0.15, 0.3))}" filter="url(#dusty)"/>`);
    // Water runs off the underside: drips mostly at the low points, a few anywhere.
    if (!vertical) for (let k = 0, n = Math.floor(fb(0, (b - a) / 260)); k < n; k++) drip(fb(a, b), at + d, fb(20, 120), frand() < 0.4);
  }
  // Couplings: collars a little wider than the pipe, the worst rust of the run.
  for (const j of joints) {
    for (const shift of wrap ? [-len, 0, len] : [0]) {
      const p = j + shift;
      const c = fb(16, 24);
      const collar = vertical ? `<rect x="${at - 4}" y="${f(p - c / 2)}" width="${d + 8}" height="${f(c)}" rx="2"/>` : `<rect x="${f(p - c / 2)}" y="${at - 4}" width="${f(c)}" height="${d + 8}" rx="2"/>`;
      add(collar.replace("/>", ` fill="url(#${vertical ? "pipeV" : "pipeH"})"/>`));
      add(collar.replace("/>", ` fill="#000" opacity="0.35"/>`));
      over(collar, rustF(), fb(0.15, 0.45));
      if (frand() < 0.6) bloom(vertical ? at + d * fb(0.3, 0.8) : p + fb(-c / 2, c / 2), vertical ? p + fb(-c / 2, c / 2) : at + d * fb(0.5, 0.9), fb(4, 10), fb(3, 7));
      if (frand() < 0.4) {
        if (!vertical) bleed(p, at + d + 4, fb(0.5, 1));
        else bleed(at + d / 2, p + c / 2, fb(0.4, 0.8));
      }
    }
  }
  // Clamps to the wall at irregular spacing, rusted thin; now and then one has rotted away
  // and left only its bolt holes and a rust shadow.
  for (let p = from + fb(120, 300); p < to - 40; p += fb(240, 420)) {
    if (frand() < 0.18) {
      const ghost = vertical ? `<rect x="${at - 10}" y="${f(p)}" width="${d + 20}" height="11"/>` : `<rect x="${f(p)}" y="${at - 10}" width="11" height="${d + 20}"/>`;
      over(ghost, rustF(), 0.4);
      add(`<circle cx="${f(vertical ? at - 6 : p + 5)}" cy="${f(vertical ? p + 5 : at - 6)}" r="2" fill="#080706"/>`);
      bleed(vertical ? at - 6 : p + 5, vertical ? p + 7 : at - 4, 0.8);
      continue;
    }
    clamp(vertical, at, d, p);
  }
}

function clamp(vertical, at, d, p) {
  const tilt = fb(-4, 4);
  const w = fb(9, 13);
  const tab = fb(9, 13);
  const cx = vertical ? at + d / 2 : p + w / 2;
  const cy = vertical ? p + w / 2 : at + d / 2;
  add(`<g transform="rotate(${f(tilt)} ${f(cx)} ${f(cy)})">`);
  // The strap over the pipe and the tab it is bolted down by.
  const strap = vertical ? `<rect x="${at - tab}" y="${f(p)}" width="${f(d + 2 * tab)}" height="${f(w)}" rx="1.5"/>` : `<rect x="${f(p)}" y="${at - tab}" width="${f(w)}" height="${f(d + 2 * tab)}" rx="1.5"/>`;
  add(strap.replace("/>", ` fill="#000" fill-opacity="0.5" filter="url(#softer)" transform="translate(2 3)"/>`));
  add(strap.replace("/>", ` fill="#3b2f26"/>`));
  over(strap, rustF(), fb(0.2, 0.5));
  add(strap.replace("/>", ` fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="1"/>`));
  add(`</g>`);
  if (vertical) {
    bolt(at - tab / 2, p + w / 2);
    bolt(at + d + tab / 2, p + w / 2);
  } else {
    bolt(p + w / 2, at - tab / 2);
    bolt(p + w / 2, at + d + tab / 2);
  }
  if (frand() < 0.45) bloom(cx + fb(-4, 4), cy + fb(-d / 2, d / 2), fb(3, 8), fb(3, 6));
}

function valve(cx, cy) {
  add(`<circle cx="${cx + 4}" cy="${cy + 6}" r="40" fill="#000" fill-opacity="0.5" filter="url(#shadow)"/>`);
  add(`<circle cx="${cx}" cy="${cy}" r="34" fill="none" stroke="#4e1d13" stroke-width="7"/>`);
  for (let a = 0; a < 3; a++) {
    const t = (a * Math.PI) / 3 + 0.3;
    add(`<line x1="${f(cx - Math.cos(t) * 32)}" y1="${f(cy - Math.sin(t) * 32)}" x2="${f(cx + Math.cos(t) * 32)}" y2="${f(cy + Math.sin(t) * 32)}" stroke="#3f1810" stroke-width="5"/>`);
  }
  add(`<circle cx="${cx}" cy="${cy}" r="34" fill="none" stroke="#000" stroke-width="7" filter="url(#${rustF()})" opacity="0.9"/>`);
  add(`<circle cx="${cx}" cy="${cy}" r="8" fill="#2e2a26"/>`);
  bloom(cx, cy, 10, 9);
  bleed(cx, cy + 36, 1.2);
}

// Rubber-sheathed cables sagging between clips; each its own shade, slightly apart. The
// rubber has gone dull and dusty; the clips are rusted.
function cables(points, colours) {
  colours.forEach((c, i) => {
    const off = i * 7;
    let d = `M${points[0][0]},${points[0][1] + off}`;
    for (let k = 1; k < points.length; k++) {
      const [x0, y0] = points[k - 1];
      const [x1, y1] = points[k];
      const sag = Math.abs(x1 - x0) > 40 ? fb(14, 30) : 0;
      d += ` Q${f((x0 + x1) / 2)},${f((y0 + y1) / 2 + off + sag)} ${x1},${y1 + off}`;
    }
    add(`<path d="${d}" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="7" transform="translate(4 7)" filter="url(#softer)"/>`);
    add(`<path d="${d}" fill="none" stroke="${c}" stroke-width="5.5" stroke-linecap="round"/>`);
    add(`<path d="${d}" fill="none" stroke="#8a7f6c" stroke-opacity="0.18" stroke-width="2" transform="translate(0 -1.5)" filter="url(#broken)"/>`);
  });
  for (const [x, y] of points.slice(1, -1)) {
    const clip = `<rect x="${x - 5}" y="${y - 5}" width="10" height="${colours.length * 7 + 6}" rx="2"/>`;
    add(clip.replace("/>", ` fill="#2f2620"/>`));
    over(clip, rustF(), fb(0.2, 0.5));
    bolt(x, y - 1);
  }
}

// A steel cabinet's weathering: worn edges, spots of grime, rust starting at bolts and seams.
function weatherBox(x, y, w, h, rx) {
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="none" stroke="#0b0907" stroke-width="10" stroke-opacity="0.45" filter="url(#edgeGrime)"/>`);
  spots(x, y, w, h, Math.round((w * h) / 1500));
  for (let i = 0, n = Math.floor(fb(0, 2.5)); i < n; i++) {
    const ex = frand() < 0.5 ? x + fb(0, 6) : x + w - fb(0, 6);
    bloom(ex, y + fb(0, h), fb(2, 5), fb(4, 9));
  }
  for (let i = 0, n = Math.floor(fb(2, 6)); i < n; i++) {
    const sx = x + fb(6, w - 6);
    const sy = y + fb(6, h - 6);
    add(`<line x1="${f(sx)}" y1="${f(sy)}" x2="${f(sx + fb(-30, 30))}" y2="${f(sy + fb(-8, 8))}" stroke="#c9c2b2" stroke-opacity="${f(fb(0.06, 0.16))}" stroke-width="0.8"/>`);
  }
}

function breakerPanel(x, y, w, h) {
  add(`<rect x="${x + 9}" y="${y + 12}" width="${w}" height="${h}" fill="#000" fill-opacity="0.6" filter="url(#shadow)"/>`);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#585b55"/>`);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="url(#blockLight)"/>`);
  over(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>`, "paintWear", 0.5);
  // Door with a seam, hinges on the left and a latch on the right.
  add(`<rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${h - 16}" rx="2" fill="none" stroke="#000" stroke-opacity="0.5" stroke-width="1.5"/>`);
  add(`<rect x="${x + 9}" y="${y + 9}" width="${w - 18}" height="1" fill="#fff" fill-opacity="0.08"/>`);
  for (const hy of [y + 30, y + h - 46]) {
    add(`<rect x="${x + 3}" y="${hy}" width="7" height="16" rx="1" fill="#3a2c22"/>`);
    if (frand() < 0.6) bloom(x + 6, hy + fb(2, 14), 3, 5);
  }
  add(`<rect x="${x + w - 22}" y="${y + h / 2 - 18}" width="10" height="36" rx="3" fill="#232220"/>`);
  add(`<rect x="${x + w - 20}" y="${y + h / 2 - 16}" width="3" height="32" fill="#fff" fill-opacity="0.08"/>`);
  for (let ly = y + h - 56; ly < y + h - 20; ly += 9) add(`<rect x="${x + 26}" y="${ly}" width="${w - 60}" height="4" rx="1" fill="#141312"/>`);
  // A small yellow warning label with a lightning flash, faded and peeling.
  const lx = x + w / 2 - 22;
  const ly = y + 34;
  add(`<polygon points="${lx + 22},${ly} ${lx + 46},${ly + 40} ${lx - 2},${ly + 40}" fill="#b89a26"/>`);
  add(`<polygon points="${lx + 22},${ly + 6} ${lx + 40},${ly + 36} ${lx + 4},${ly + 36}" fill="none" stroke="#151412" stroke-width="2.5"/>`);
  add(`<path d="M${lx + 25},${ly + 13} l-7,12 h6 l-4,9 l9,-13 h-6 l4,-8 z" fill="#151412"/>`);
  add(`<polygon points="${lx + 34},${ly + 40} ${lx + 46},${ly + 40} ${lx + 40},${ly + 30}" fill="#585b55"/>`);
  add(`<rect x="${x + 22}" y="${y + 92}" width="${w - 44}" height="16" fill="#cfc8b2" fill-opacity="0.45"/>`);
  add(`<text x="${x + w / 2}" y="${y + 104}" text-anchor="middle" font-family="'Arial Narrow', Arial, sans-serif" font-weight="bold" font-size="11" letter-spacing="1" fill="#1a1917" fill-opacity="0.7">MAIN BREAKER</text>`);
  weatherBox(x, y, w, h, 3);
  for (const [sx, sy] of [[x + 5, y + 5], [x + w - 5, y + 5], [x + 5, y + h - 5], [x + w - 5, y + h - 5]]) bolt(sx, sy, false);
  for (let i = 0; i < 2; i++) bleed(x + fb(6, w - 6), y + h, fb(0.4, 0.8));
}

function junctionBox(x, y, w, h, conduitTo) {
  pipe({ vertical: true, at: x + w / 2 - 7, d: 14, from: conduitTo, to: y });
  add(`<rect x="${x + 8}" y="${y + 10}" width="${w}" height="${h}" fill="#000" fill-opacity="0.55" filter="url(#shadow)"/>`);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#4b4f47"/>`);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="url(#blockLight)"/>`);
  over(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>`, "paintWear", 0.6);
  add(`<rect x="${x + 10}" y="${y + 10}" width="${w - 20}" height="${h - 20}" rx="2" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="2"/>`);
  weatherBox(x, y, w, h, 4);
  for (const [sx, sy] of [[x + 9, y + 9], [x + w - 9, y + 9], [x + 9, y + h - 9], [x + w - 9, y + h - 9]]) bolt(sx, sy, false);
  bleed(x + fb(6, w - 6), y + h, fb(0.4, 0.8));
}

function vent(x, y, w, h) {
  add(`<rect x="${x + 6}" y="${y + 8}" width="${w}" height="${h}" fill="#000" fill-opacity="0.5" filter="url(#shadow)"/>`);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#3c3a36"/>`);
  for (let sy = y + 12; sy < y + h - 10; sy += 12) {
    add(`<rect x="${x + 10}" y="${sy}" width="${w - 20}" height="7" fill="#0e0d0c"/>`);
    add(`<rect x="${x + 10}" y="${sy + 7}" width="${w - 20}" height="2" fill="#fff" fill-opacity="0.06"/>`);
    if (frand() < 0.15) bloom(x + fb(14, w - 14), sy + 8, fb(4, 10), 2);
  }
  weatherBox(x, y, w, h, 3);
  for (const [sx, sy] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]]) bolt(sx, sy, false);
  // Soot blown out of the vent onto the wall above it.
  add(`<ellipse cx="${x + w / 2}" cy="${y - 20}" rx="${w * 0.6}" ry="60" fill="#0a0908" fill-opacity="0.5" filter="url(#sooty)"/>`);
  for (let i = 0; i < 2; i++) bleed(x + fb(10, w - 10), y + h, fb(0.4, 0.8));
}

// An enamel sign screwed to the wall: faded, a little rust at corners and edges, a few spots
// of grime, and rust running from its screws.
function warningSign(x, y, w, h, tilt) {
  add(`<g transform="rotate(${tilt} ${x + w / 2} ${y + h / 2})">`);
  add(`<rect x="${x + 6}" y="${y + 9}" width="${w}" height="${h}" fill="#000" fill-opacity="0.55" filter="url(#shadow)"/>`);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#b3922a"/>`);
  over(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>`, "paintWear", 0.35);
  add(`<rect x="${x + 6}" y="${y + 6}" width="${w - 12}" height="${h - 12}" rx="2" fill="none" stroke="#1a1816" stroke-width="3"/>`);
  add(`<rect x="${x + 6}" y="${y + 6}" width="${w - 12}" height="34" fill="#1a1816"/>`);
  add(`<text x="${x + w / 2}" y="${y + 33}" text-anchor="middle" font-family="Impact, 'Arial Narrow', sans-serif" font-size="26" letter-spacing="3" fill="#b3922a">DANGER</text>`);
  // The flash and HIGH VOLTAGE as one group, centred on the sign: triangle 68 wide, a 12 gap,
  // then the words (about 75 wide in Impact 22).
  const tx = x + (w - 155) / 2 + 34;
  const ty = y + 54;
  add(`<polygon points="${tx},${ty} ${tx + 34},${ty + 58} ${tx - 34},${ty + 58}" fill="none" stroke="#1a1816" stroke-width="5" stroke-linejoin="round"/>`);
  add(`<path d="M${tx + 4},${ty + 16} l-11,19 h9 l-6,15 l14,-21 h-9 l6,-13 z" fill="#1a1816"/>`);
  add(`<text x="${tx + 46}" y="${y + 80}" font-family="Impact, 'Arial Narrow', sans-serif" font-size="22" fill="#1a1816">HIGH</text>`);
  add(`<text x="${tx + 46}" y="${y + 104}" font-family="Impact, 'Arial Narrow', sans-serif" font-size="22" fill="#1a1816">VOLTAGE</text>`);
  add(`<text x="${x + w / 2}" y="${y + h - 16}" text-anchor="middle" font-family="'Arial Narrow', Arial, sans-serif" font-weight="bold" font-size="11" letter-spacing="1" fill="#1a1816">AUTHORISED PERSONNEL ONLY</text>`);
  // A little rust where the enamel wears through first: some corners, a few spots on the edges.
  for (const [cx, cy] of [[x + 3, y + 3], [x + w - 3, y + 3], [x + 3, y + h - 3], [x + w - 3, y + h - 3]]) {
    if (frand() < 0.6) bloom(cx, cy, fb(3, 6), fb(3, 6));
  }
  for (let i = 0, n = Math.floor(fb(2, 4)); i < n; i++) {
    const side = Math.floor(frand() * 4);
    const along = fb(0.15, 0.85);
    const [ex, ey] = [[x + w * along, y + 1], [x + w - 1, y + h * along], [x + w * along, y + h - 1], [x + 1, y + h * along]][side];
    bloom(ex, ey, fb(2, 5), fb(2, 4));
  }
  spots(x, y, w, h, 11);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="none" stroke="#0b0907" stroke-width="8" stroke-opacity="0.35" filter="url(#edgeGrime)"/>`);
  for (const [sx, sy] of [[x + 12, y + 12], [x + w - 12, y + 12], [x + 12, y + h - 12], [x + w - 12, y + h - 12]]) bolt(sx, sy, false);
  add(`</g>`);
  for (const sx of [x + 12, x + w - 12]) bleed(sx, y + h - 6, fb(0.6, 1.1));
}

// Layout. The notes sit at the top centre of the screen, which is the tile's top centre.
cables([[0, 368], [260, 362], [560, 366], [900, 362], [1150, 366], [1600, 368]], ["#1d1c1a", "#2a2623", "#3b2a1c"]);
pipe({ at: 470, d: 42, wrap: true });
pipe({ at: 526, d: 20, wrap: true });
pipe({ vertical: true, at: 1210, d: 36, wrap: true });
valve(1228, 980);
pipe({ at: 1236, d: 28, from: 0, to: 1210 }); // a lower return pipe that ends in the riser
pipe({ vertical: true, at: 96, d: 24, from: 546, to: 1236 }); // a drop between the two runs
breakerPanel(232, 690, 150, 210);
cables([[307, 900], [307, 1000], [420, 1010], [560, 1004], [640, 1010]], ["#1d1c1a", "#2b2724"]);
junctionBox(640, 980, 110, 130, 546);
warningSign(1290, 640, 230, 150, 1.4);
vent(1330, 1040, 190, 120);
for (let i = 0; i < 30; i++) drip(fb(0, W), 0, fb(30, 110), frand() < 0.35);
// Sprayed stencil of the level, mostly worn off the concrete.
add(`<text x="1385" y="300" font-family="Impact, 'Arial Narrow', sans-serif" font-size="120" fill="#e8e2d0" fill-opacity="0.2" letter-spacing="10" transform="rotate(-1 1385 300)" filter="url(#stencil)">B2</text>`);
// A last wash of dirt so nothing looks freshly drawn.
add(`<rect width="${W}" height="${H}" filter="url(#grimeLarge)"/>`);

const defs = `<defs>
<radialGradient id="boltGrad" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#7e7b73"/><stop offset="0.5" stop-color="#4b4843"/><stop offset="1" stop-color="#1b1a18"/></radialGradient>
<g id="bolt"><circle cx="1" cy="1.4" r="3.6" fill="#000" fill-opacity="0.6"/><circle r="3" fill="url(#boltGrad)"/><line x1="-2" y1="0" x2="2" y2="0" stroke="#111" stroke-width="0.8"/></g>
<linearGradient id="blockLight" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.06"/><stop offset="0.55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.16"/></linearGradient>
<linearGradient id="pipeH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2926"/><stop offset="0.3" stop-color="#5f5b54"/><stop offset="0.42" stop-color="#726d63"/><stop offset="0.8" stop-color="#3d3a35"/><stop offset="1" stop-color="#161513"/></linearGradient>
<linearGradient id="pipeV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2b2926"/><stop offset="0.3" stop-color="#5f5b54"/><stop offset="0.42" stop-color="#726d63"/><stop offset="0.8" stop-color="#3d3a35"/><stop offset="1" stop-color="#161513"/></linearGradient>
<linearGradient id="dripDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050403" stop-opacity="0.6"/><stop offset="1" stop-color="#050403" stop-opacity="0"/></linearGradient>
<linearGradient id="dripRust" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5e2a10" stop-opacity="0.6"/><stop offset="1" stop-color="#5e2a10" stop-opacity="0"/></linearGradient>
<filter id="edgeGrime" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="11" result="b"/><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="4" seed="41"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2.4 0 0 0 -0.7" result="n"/><feComposite in="b" in2="n" operator="in"/></filter>
<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>
<filter id="softer" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="1.6"/></filter>
<filter id="sooty" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="22" result="b"/><feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="3" seed="8"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2 0 0 0 -0.4" result="n"/><feComposite in="b" in2="n" operator="in"/></filter>
<filter id="shadow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="7"/></filter>
<filter id="mortar" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" seed="13" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.08 0 0 0 0 0.075 0 0 0 0 0.07 1.6 0 0 0 -0.55"/></filter>
<filter id="mottle" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="4" seed="21" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 0.97 2 0 0 0 -0.9"/></filter>
<filter id="pores" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.45" numOctaves="2" seed="5" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.05 0 0 0 0 0.045 0 0 0 0 0.04 5 0 0 0 -3.3"/></filter>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="7" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.8 0 0 0 0 0.79 0 0 0 0 0.76 0 1.1 0 0 -0.62"/></filter>
<filter id="grime" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves="5" seed="11" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.05 0 0 0 0 0.04 0 0 0 0 0.03 2.6 0 0 0 -1.05"/></filter>
<filter id="streaks" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0125 0.0015" numOctaves="4" seed="17" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.06 0 0 0 0 0.05 0 0 0 0 0.035 3 0 0 0 -1.35"/></filter>
<filter id="grimeLarge" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0035" numOctaves="3" seed="29" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.03 0 0 0 0 0.025 0 0 0 0 0.02 2.1 0 0 0 -0.95"/></filter>
<filter id="grimeFine"><feTurbulence type="fractalNoise" baseFrequency="0.035 0.12" numOctaves="3" seed="3"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.3 0 0 0 -0.5"/><feComposite in2="SourceGraphic" operator="in"/></filter>
<filter id="stencil"><feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed="9"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2.2 0 0 0 -0.7"/><feComposite in="SourceGraphic" operator="in"/></filter>
<radialGradient id="boltRustGrad" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#7a5038"/><stop offset="0.5" stop-color="#4d2c1a"/><stop offset="1" stop-color="#1b120c"/></radialGradient>
<g id="boltRust"><circle cx="1" cy="1.4" r="3.8" fill="#000" fill-opacity="0.6"/><circle r="3.2" fill="url(#boltRustGrad)"/><line x1="-2" y1="0" x2="2" y2="0" stroke="#160d08" stroke-width="0.9"/></g>
<filter id="rust0"><feTurbulence type="fractalNoise" baseFrequency="0.020 0.096" numOctaves="4" seed="31"/><feColorMatrix values="0 0 0 0 0.27 0 0 0 0 0.12 0 0 0 0 0.05 1.8 0 0 0 -0.67"/><feComposite in2="SourceGraphic" operator="in"/></filter>
<filter id="rust1"><feTurbulence type="fractalNoise" baseFrequency="0.034 0.076" numOctaves="4" seed="44"/><feColorMatrix values="0 0 0 0 0.31 0 0 0 0 0.12 0 0 0 0 0.05 1.8 0 0 0 -0.81"/><feComposite in2="SourceGraphic" operator="in"/></filter>
<filter id="rust2"><feTurbulence type="fractalNoise" baseFrequency="0.032 0.058" numOctaves="4" seed="57"/><feColorMatrix values="0 0 0 0 0.26 0 0 0 0 0.10 0 0 0 0 0.05 1.8 0 0 0 -0.75"/><feComposite in2="SourceGraphic" operator="in"/></filter>
<filter id="rust3"><feTurbulence type="fractalNoise" baseFrequency="0.043 0.030" numOctaves="4" seed="70"/><feColorMatrix values="0 0 0 0 0.24 0 0 0 0 0.11 0 0 0 0 0.05 1.8 0 0 0 -0.79"/><feComposite in2="SourceGraphic" operator="in"/></filter>
<filter id="rust4"><feTurbulence type="fractalNoise" baseFrequency="0.050 0.082" numOctaves="4" seed="83"/><feColorMatrix values="0 0 0 0 0.25 0 0 0 0 0.09 0 0 0 0 0.05 1.8 0 0 0 -0.63"/><feComposite in2="SourceGraphic" operator="in"/></filter>
<filter id="rust5"><feTurbulence type="fractalNoise" baseFrequency="0.027 0.112" numOctaves="4" seed="96"/><feColorMatrix values="0 0 0 0 0.26 0 0 0 0 0.09 0 0 0 0 0.05 1.8 0 0 0 -0.71"/><feComposite in2="SourceGraphic" operator="in"/></filter>
<filter id="rust6"><feTurbulence type="fractalNoise" baseFrequency="0.038 0.113" numOctaves="4" seed="109"/><feColorMatrix values="0 0 0 0 0.28 0 0 0 0 0.11 0 0 0 0 0.05 1.8 0 0 0 -0.71"/><feComposite in2="SourceGraphic" operator="in"/></filter>
<filter id="rust7"><feTurbulence type="fractalNoise" baseFrequency="0.070 0.057" numOctaves="4" seed="122"/><feColorMatrix values="0 0 0 0 0.24 0 0 0 0 0.11 0 0 0 0 0.05 1.8 0 0 0 -0.69"/><feComposite in2="SourceGraphic" operator="in"/></filter>
<filter id="bloom0" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="b"/><feTurbulence type="fractalNoise" baseFrequency="0.12" numOctaves="3" seed="61"/><feColorMatrix values="0 0 0 0 0.24 0 0 0 0 0.1 0 0 0 0 0.04 2 0 0 0 -0.55" result="n"/><feComposite in="n" in2="b" operator="in"/></filter>
<filter id="bloom1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5" result="b"/><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="67"/><feColorMatrix values="0 0 0 0 0.19 0 0 0 0 0.08 0 0 0 0 0.03 2 0 0 0 -0.5" result="n"/><feComposite in="n" in2="b" operator="in"/></filter>
<filter id="bloom2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2" result="b"/><feTurbulence type="fractalNoise" baseFrequency="0.16" numOctaves="2" seed="71"/><feColorMatrix values="0 0 0 0 0.29 0 0 0 0 0.12 0 0 0 0 0.04 2.2 0 0 0 -0.65" result="n"/><feComposite in="n" in2="b" operator="in"/></filter>
<filter id="blotch0" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b"/><feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="3" seed="81"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2.2 0 0 0 -0.5" result="n"/><feComposite in="b" in2="n" operator="in"/></filter>
<filter id="blotch1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8" result="b"/><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="83"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2 0 0 0 -0.45" result="n"/><feComposite in="b" in2="n" operator="in"/></filter>
<filter id="blotch2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feTurbulence type="fractalNoise" baseFrequency="0.11" numOctaves="2" seed="89"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2.4 0 0 0 -0.6" result="n"/><feComposite in="b" in2="n" operator="in"/></filter>
<filter id="pipePatches"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="21"/><feColorMatrix values="0 0 0 0 0.07 0 0 0 0 0.055 0 0 0 0 0.04 2.1 0 0 0 -0.95"/><feComposite in2="SourceGraphic" operator="in"/></filter>
<filter id="pipePits"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0.05 0 0 0 0 0.04 0 0 0 0 0.03 3.4 0 0 0 -2.2"/><feComposite in2="SourceGraphic" operator="in"/></filter>
<filter id="dusty"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="63"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2.2 0 0 0 -0.8" result="n"/><feComposite in="SourceGraphic" in2="n" operator="in"/></filter>
<filter id="broken"><feTurbulence type="fractalNoise" baseFrequency="0.05 0.2" numOctaves="2" seed="57"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2.6 0 0 0 -1" result="n"/><feComposite in="SourceGraphic" in2="n" operator="in"/></filter>
<filter id="crackFx" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse"><feMorphology in="SourceAlpha" operator="dilate" radius="1.6"/><feGaussianBlur stdDeviation="1.6"/><feColorMatrix values="0 0 0 0 0.04 0 0 0 0 0.035 0 0 0 0 0.03 0 0 0 0.32 0" result="halo"/><feOffset in="SourceAlpha" dx="0.7" dy="1.1"/><feComposite in2="SourceAlpha" operator="out"/><feColorMatrix values="0 0 0 0 0.84 0 0 0 0 0.82 0 0 0 0 0.78 0 0 0 0.09 0" result="lip"/><feMerge><feMergeNode in="halo"/><feMergeNode in="lip"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="paintWear"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="59"/><feColorMatrix values="0 0 0 0 0.2 0 0 0 0 0.19 0 0 0 0 0.17 2 0 0 0 -1.05"/><feComposite in2="SourceGraphic" operator="in"/></filter>
</defs>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}${out.join("")}</svg>`;
writeFileSync("public/bunker-wall.svg", svg);
console.log(`public/bunker-wall.svg: ${rows.length} rows, ${rows.reduce((n, r) => n + r.blocks.length, 0)} blocks, ${(svg.length / 1024).toFixed(0)} KB`);
