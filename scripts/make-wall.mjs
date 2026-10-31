// Generates public/bunker-wall.svg: the wall behind the notes, a basement of a bunker.
// Run: node scripts/make-wall.mjs   (the output is committed; this is only needed to change it)
//
// Riveted steel plates of random sizes in staggered rows, each overlapping its neighbours
// (upper rows over lower ones, right plates over left ones) with shadows and rivets on the
// overlapping edge. Grime gathers dark along every edge and seam; on top come blotchy dirt,
// rust streaks and drips, a few missing or rusted rivets, and the fittings of a basement:
// pipes with brackets and flanges, a valve, a junction box with conduit, a vent and a level
// stencil. A seeded random keeps the wall the same on every build. The tile wraps on all
// four sides, so it repeats without visible seams.
import { writeFileSync } from "node:fs";

const W = 1600;
const H = 1400;

let seed = 20261031;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const between = (a, b) => a + rand() * (b - a);
const f = (n) => Math.round(n * 10) / 10;

const out = [];
const add = (s) => out.push(s);

// Plates ---------------------------------------------------------------------------------
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
  const plates = [];
  for (let x = start; x < start + W; ) {
    let w = Math.round(between(230, 560));
    if (x + w > start + W - 150) w = start + W - x; // last plate meets the first one round the wrap
    plates.push({ x, w, tint: Math.round(between(70, 92)) });
    x += w;
  }
  rows.push({ y: top, h, plates });
  top += h;
}

const tint = (t) => `rgb(${t},${t - 3},${t - 8})`;
let clipId = 0;

function plate(x, y, w, h, t) {
  const id = `c${clipId++}`;
  add(`<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>`);
  // Shadow cast down onto the row below, and to the left onto the plate it overlaps.
  add(`<rect x="${x}" y="${y + h}" width="${w}" height="16" fill="url(#shDown)"/>`);
  add(`<rect x="${x - 14}" y="${y}" width="14" height="${h}" fill="url(#shLeft)"/>`);
  add(`<g clip-path="url(#${id})">`);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${tint(t)}"/>`);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#plateLight)"/>`);
  // Grime collects along the edges and seams: a blurred dark border inside the plate.
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#0b0907" stroke-width="${f(between(30, 46))}" stroke-opacity="${f(between(0.7, 0.95))}" filter="url(#edgeGrime)"/>`);
  add(`</g>`);
  // The plate's exposed edges: a worn highlight on top of a dark cut line.
  add(`<rect x="${x}" y="${y + h - 2}" width="${w}" height="2" fill="#000" fill-opacity="0.6"/>`);
  add(`<rect x="${x}" y="${y + h - 3}" width="${w}" height="1" fill="#fff" fill-opacity="0.07"/>`);
  add(`<rect x="${x}" y="${y}" width="2" height="${h}" fill="#000" fill-opacity="0.5"/>`);
  add(`<rect x="${x + 2}" y="${y}" width="1" height="${h}" fill="#fff" fill-opacity="0.06"/>`);
  // Rivets along the two overlapping edges, irregularly spaced; some gone, some rusted.
  for (let rx = x + between(12, 22); rx < x + w - 10; rx += between(26, 36)) rivet(rx + between(-1.5, 1.5), y + h - 11 + between(-1.5, 1.5));
  for (let ry = y + between(20, 34); ry < y + h - 18; ry += between(26, 36)) rivet(x + 11 + between(-1.5, 1.5), ry);
}

function rivet(x, y) {
  const roll = rand();
  if (roll < 0.05) {
    add(`<circle cx="${f(x)}" cy="${f(y)}" r="2.4" fill="#070605"/>`); // missing: just the hole
    return;
  }
  if (roll < 0.12) add(`<circle cx="${f(x + 1)}" cy="${f(y + 4)}" r="${f(between(5, 9))}" fill="#5a2c12" fill-opacity="0.35" filter="url(#soft)"/>`);
  add(`<use href="#rivet" x="${f(x)}" y="${f(y)}"/>`);
}

// Rows bottom-up so upper rows lie over lower ones; plates left to right so right overlaps left.
// Each plate is drawn three times, shifted by the tile width, so the rows wrap seamlessly.
for (const row of [...rows].reverse()) {
  for (const p of row.plates) for (const dx of [-W, 0, W]) plate(p.x + dx, row.y, p.w, row.h, p.tint);
}
// The bottom row of the tile above overlaps this tile's top row.
add(`<rect x="0" y="0" width="${W}" height="16" fill="url(#shDown)"/>`);

// Dirt over the whole wall -------------------------------------------------------------------
add(`<rect width="${W}" height="${H}" filter="url(#grime)"/>`);
add(`<rect width="${W}" height="${H}" filter="url(#specks)"/>`);

// Fittings ---------------------------------------------------------------------------------
const drips = (x0, x1, y0, count, maxLen) => {
  for (let i = 0; i < count; i++) {
    const x = between(x0, x1);
    const len = between(30, maxLen);
    const rusty = rand() < 0.35;
    add(`<rect x="${f(x)}" y="${f(y0)}" width="${f(between(2, 6))}" height="${f(len)}" fill="url(#${rusty ? "dripRust" : "dripDark"})" filter="url(#softer)"/>`);
  }
};

function hPipe(y, d) {
  add(`<rect x="0" y="${y + d * 0.6}" width="${W}" height="${d}" fill="#000" fill-opacity="0.55" filter="url(#shadow)"/>`);
  add(`<rect x="0" y="${y}" width="${W}" height="${d}" fill="url(#pipeH)"/>`);
  add(`<rect x="0" y="${y}" width="${W}" height="${d}" fill="url(#pipeGrime)" filter="url(#grimeFine)"/>`);
  for (let x = between(80, 200); x < W; x += between(380, 520)) {
    add(`<rect x="${f(x)}" y="${y - 4}" width="16" height="${d + 8}" rx="2" fill="url(#pipeH)"/>`);
    add(`<rect x="${f(x)}" y="${y - 4}" width="16" height="${d + 8}" rx="2" fill="#000" fill-opacity="0.25"/>`);
    add(`<circle cx="${f(x + 8)}" cy="${y + d / 2}" r="${f(between(10, 18))}" fill="#6b3416" fill-opacity="0.3" filter="url(#soft)"/>`);
  }
  for (let x = between(220, 320); x < W; x += between(300, 360)) {
    add(`<rect x="${f(x)}" y="${y - 10}" width="12" height="${d + 20}" fill="#1e1c1a"/>`);
    add(`<rect x="${f(x - 6)}" y="${y - 14}" width="24" height="6" fill="#2a2724"/>`);
    add(`<use href="#bolt" x="${f(x + 6)}" y="${y - 11}"/>`);
  }
  drips(0, W, y + d, 22, 170);
}

function vPipe(x, d) {
  add(`<rect x="${x + d * 0.5}" y="0" width="${d}" height="${H}" fill="#000" fill-opacity="0.55" filter="url(#shadow)"/>`);
  add(`<rect x="${x}" y="0" width="${d}" height="${H}" fill="url(#pipeV)"/>`);
  add(`<rect x="${x}" y="0" width="${d}" height="${H}" fill="url(#pipeGrime)" filter="url(#grimeFine)"/>`);
  for (let y = between(60, 160); y < H; y += between(420, 560)) {
    add(`<rect x="${x - 4}" y="${f(y)}" width="${d + 8}" height="16" rx="2" fill="url(#pipeV)"/>`);
    add(`<rect x="${x - 4}" y="${f(y)}" width="${d + 8}" height="16" rx="2" fill="#000" fill-opacity="0.25"/>`);
  }
  for (let y = between(200, 300); y < H; y += between(320, 380)) {
    add(`<rect x="${x - 12}" y="${f(y)}" width="${d + 24}" height="12" fill="#1e1c1a"/>`);
    add(`<use href="#bolt" x="${x - 6}" y="${f(y + 6)}"/>`);
    add(`<use href="#bolt" x="${x + d + 6}" y="${f(y + 6)}"/>`);
  }
}

function valve(cx, cy) {
  add(`<circle cx="${cx + 4}" cy="${cy + 6}" r="40" fill="#000" fill-opacity="0.5" filter="url(#shadow)"/>`);
  add(`<circle cx="${cx}" cy="${cy}" r="34" fill="none" stroke="#5c1f14" stroke-width="7"/>`);
  add(`<circle cx="${cx}" cy="${cy}" r="34" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="7" filter="url(#grimeFine)"/>`);
  for (let a = 0; a < 3; a++) {
    const t = (a * Math.PI) / 3 + 0.3;
    add(`<line x1="${f(cx - Math.cos(t) * 32)}" y1="${f(cy - Math.sin(t) * 32)}" x2="${f(cx + Math.cos(t) * 32)}" y2="${f(cy + Math.sin(t) * 32)}" stroke="#4a1a11" stroke-width="5"/>`);
  }
  add(`<circle cx="${cx}" cy="${cy}" r="8" fill="#3a3632"/>`);
}

function junctionBox(x, y, w, h) {
  add(`<rect x="${x + 8}" y="${y + 10}" width="${w}" height="${h}" fill="#000" fill-opacity="0.55" filter="url(#shadow)"/>`);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#4d5149"/>`);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="url(#plateLight)"/>`);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="none" stroke="#0b0907" stroke-width="22" stroke-opacity="0.6" filter="url(#soft)"/>`);
  add(`<rect x="${x + 10}" y="${y + 10}" width="${w - 20}" height="${h - 20}" rx="2" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="2"/>`);
  for (const [sx, sy] of [[x + 9, y + 9], [x + w - 9, y + 9], [x + 9, y + h - 9], [x + w - 9, y + h - 9]]) add(`<use href="#bolt" x="${sx}" y="${sy}"/>`);
  add(`<rect x="${x + w / 2 - 22}" y="${y + 34}" width="44" height="22" fill="#c9b21a" fill-opacity="0.35"/>`);
  add(`<rect x="${x + w / 2 - 22}" y="${y + 34}" width="44" height="22" fill="#000" fill-opacity="0.3" filter="url(#grimeFine)"/>`);
  // Conduit up from the box into the pipe run.
  add(`<rect x="${x + w / 2 - 7 + 6}" y="${y - 260}" width="14" height="260" fill="#000" fill-opacity="0.5" filter="url(#shadow)"/>`);
  add(`<rect x="${x + w / 2 - 7}" y="${y - 260}" width="14" height="260" fill="url(#pipeV)"/>`);
  drips(x, x + w, y + h, 6, 120);
}

function vent(x, y, w, h) {
  add(`<rect x="${x + 6}" y="${y + 8}" width="${w}" height="${h}" fill="#000" fill-opacity="0.5" filter="url(#shadow)"/>`);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#3c3a36"/>`);
  for (let sy = y + 12; sy < y + h - 10; sy += 12) {
    add(`<rect x="${x + 10}" y="${sy}" width="${w - 20}" height="7" fill="#0e0d0c"/>`);
    add(`<rect x="${x + 10}" y="${sy + 7}" width="${w - 20}" height="2" fill="#fff" fill-opacity="0.07"/>`);
  }
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="none" stroke="#000" stroke-opacity="0.6" stroke-width="16" filter="url(#soft)"/>`);
  for (const [sx, sy] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]]) add(`<use href="#bolt" x="${sx}" y="${sy}"/>`);
  drips(x + 10, x + w - 10, y + h, 8, 140);
}

hPipe(470, 42);
hPipe(526, 20);
vPipe(1210, 36);
valve(1228, 980);
junctionBox(250, 820, 130, 160);
vent(1330, 1080, 190, 120);
drips(0, W, 0, 30, 110);
// Painted level marking, mostly worn off.
add(`<text x="1385" y="300" font-family="Impact, 'Arial Narrow', sans-serif" font-size="120" fill="#e8e2d0" fill-opacity="0.17" letter-spacing="10" transform="rotate(-1 1385 300)" filter="url(#grimeFine)">B2</text>`);
// A last wash of dirt so nothing looks freshly drawn.
add(`<rect width="${W}" height="${H}" filter="url(#grimeLarge)"/>`);

const defs = `<defs>
<radialGradient id="rivetGrad" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#7e7b73"/><stop offset="0.5" stop-color="#4b4843"/><stop offset="1" stop-color="#1b1a18"/></radialGradient>
<g id="rivet"><circle cx="1.2" cy="1.8" r="4.4" fill="#000" fill-opacity="0.6"/><circle r="3.6" fill="url(#rivetGrad)"/></g>
<g id="bolt"><circle cx="1" cy="1.4" r="3.6" fill="#000" fill-opacity="0.6"/><circle r="3" fill="url(#rivetGrad)"/><line x1="-2" y1="0" x2="2" y2="0" stroke="#111" stroke-width="0.8"/></g>
<linearGradient id="plateLight" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.07"/><stop offset="0.55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.18"/></linearGradient>
<linearGradient id="shDown" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.7"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
<linearGradient id="shLeft" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.6"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
<linearGradient id="pipeH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2926"/><stop offset="0.3" stop-color="#5f5b54"/><stop offset="0.42" stop-color="#726d63"/><stop offset="0.8" stop-color="#3d3a35"/><stop offset="1" stop-color="#161513"/></linearGradient>
<linearGradient id="pipeV" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2b2926"/><stop offset="0.3" stop-color="#5f5b54"/><stop offset="0.42" stop-color="#726d63"/><stop offset="0.8" stop-color="#3d3a35"/><stop offset="1" stop-color="#161513"/></linearGradient>
<linearGradient id="pipeGrime"><stop offset="0" stop-color="#000"/></linearGradient>
<linearGradient id="dripDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050403" stop-opacity="0.55"/><stop offset="1" stop-color="#050403" stop-opacity="0"/></linearGradient>
<linearGradient id="dripRust" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5e2a10" stop-opacity="0.5"/><stop offset="1" stop-color="#5e2a10" stop-opacity="0"/></linearGradient>
<filter id="edgeGrime" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="11" result="b"/><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="4" seed="41"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2.4 0 0 0 -0.75" result="n"/><feComposite in="b" in2="n" operator="in"/></filter>
<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>
<filter id="softer" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="1.6"/></filter>
<filter id="shadow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="7"/></filter>
<filter id="grime" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.009" numOctaves="5" seed="11" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.04 0 0 0 0 0.035 0 0 0 0 0.03 2.2 0 0 0 -1.05"/></filter>
<filter id="grimeLarge" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0035" numOctaves="3" seed="29" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.03 0 0 0 0 0.025 0 0 0 0 0.02 1.9 0 0 0 -0.95"/></filter>
<filter id="specks" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="5" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.05 0 0 0 0 0.04 0 0 0 0 0.03 3.4 0 0 0 -2.25"/></filter>
<filter id="grimeFine"><feTurbulence type="fractalNoise" baseFrequency="0.035 0.12" numOctaves="3" seed="3"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.3 0 0 0 -0.55"/><feComposite in2="SourceGraphic" operator="in"/></filter>
</defs>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}${out.join("")}</svg>`;
writeFileSync("public/bunker-wall.svg", svg);
console.log(`public/bunker-wall.svg: ${rows.length} rows, ${rows.reduce((n, r) => n + r.plates.length, 0)} plates, ${(svg.length / 1024).toFixed(0)} KB`);
