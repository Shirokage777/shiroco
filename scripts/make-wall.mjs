// Generates public/bunker-wall.svg: the wall behind the notes, a basement of a bunker.
// Run: node scripts/make-wall.mjs   (the output is committed; this is only needed to change it)
//
// Grey concrete blocks of random sizes in staggered rows, set in recessed mortar. Grime
// gathers dark along every joint; the faces are pitted and grainy, a few corners are chipped
// and a few blocks cracked, and water stains run down the whole wall. Over the wall run the
// fittings of a basement: pipes with brackets, flanges and a valve (rusted, as metal is),
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
  // A hairline crack wandering across some blocks.
  if (b.cracked) {
    let cx = bx + between(bw * 0.2, bw * 0.8);
    let cy = by;
    const d = [`M${f(cx)},${f(cy)}`];
    while (cy < by + bh * between(0.5, 1)) {
      cx += between(-14, 14);
      cy += between(10, 24);
      d.push(`L${f(cx)},${f(cy)}`);
    }
    add(`<path d="${d.join("")}" fill="none" stroke="#fff" stroke-opacity="0.07" stroke-width="1.2" transform="translate(1 1)"/>`);
    add(`<path d="${d.join("")}" fill="none" stroke="#0d0c0b" stroke-opacity="0.75" stroke-width="1.1"/>`);
  }
  // Grime collects along the joints: a patchy, blurred dark border over the block's edge.
  add(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="none" stroke="#0b0907" stroke-width="${f(between(26, 40))}" stroke-opacity="${f(between(0.75, 0.95))}" filter="url(#edgeGrime)"/>`);
}

// Mortar: darker, rough and recessed, so it reads as the shadowed joint between the blocks.
add(`<rect width="${W}" height="${H}" fill="#3a3834"/>`);
add(`<rect width="${W}" height="${H}" filter="url(#mortar)"/>`);
// Each block is drawn three times, shifted by the tile width, so the rows wrap seamlessly.
for (const row of rows) for (const b of row.blocks) for (const dx of [-W, 0, W]) block(b.x + dx, row.y, b.w, row.h, b);

// Concrete surface and dirt over the whole wall -------------------------------------------------
add(`<rect width="${W}" height="${H}" filter="url(#mottle)" opacity="0.12"/>`);
add(`<rect width="${W}" height="${H}" filter="url(#pores)"/>`);
add(`<rect width="${W}" height="${H}" filter="url(#grain)"/>`);
add(`<rect width="${W}" height="${H}" filter="url(#grime)"/>`);
add(`<rect width="${W}" height="${H}" filter="url(#streaks)" opacity="0.8"/>`);

// Fittings ---------------------------------------------------------------------------------
const drips = (x0, x1, y0, count, maxLen, rustShare = 0.35) => {
  for (let i = 0; i < count; i++) {
    const x = between(x0, x1);
    const rusty = rand() < rustShare;
    add(`<rect x="${f(x)}" y="${f(y0)}" width="${f(between(2, 7))}" height="${f(between(30, maxLen))}" fill="url(#${rusty ? "dripRust" : "dripDark"})" filter="url(#softer)"/>`);
  }
};
const bolt = (x, y) => add(`<use href="#bolt" x="${f(x)}" y="${f(y)}"/>`);
// Rust and dirt laid over a metal shape: the overlay repeats the shape and is cut to it.
const rusted = (shape) => {
  add(shape.replace("/>", ` fill="#000" filter="url(#rust)"/>`).replace(/ fill="url\(#[^)]+\)"| fill="#[0-9a-f]+"/, ""));
  add(shape.replace("/>", ` fill="#000" filter="url(#grimeFine)"/>`).replace(/ fill="url\(#[^)]+\)"| fill="#[0-9a-f]+"/, ""));
};

function hPipe(y, d, x0 = 0, x1 = W) {
  add(`<rect x="${x0}" y="${y + d * 0.6}" width="${x1 - x0}" height="${d}" fill="#000" fill-opacity="0.6" filter="url(#shadow)"/>`);
  add(`<rect x="${x0}" y="${y}" width="${x1 - x0}" height="${d}" fill="url(#pipeH)"/>`);
  rusted(`<rect x="${x0}" y="${y}" width="${x1 - x0}" height="${d}"/>`);
  for (let x = x0 + between(80, 200); x < x1 - 20; x += between(380, 520)) {
    add(`<rect x="${f(x)}" y="${y - 4}" width="16" height="${d + 8}" rx="2" fill="url(#pipeH)"/>`);
    add(`<rect x="${f(x)}" y="${y - 4}" width="16" height="${d + 8}" rx="2" fill="#000" fill-opacity="0.3"/>`);
    add(`<circle cx="${f(x + 8)}" cy="${y + d / 2}" r="${f(between(12, 20))}" fill="#6b3416" fill-opacity="0.4" filter="url(#soft)"/>`);
    drips(x - 4, x + 20, y + d + 4, 3, 160, 0.8);
  }
  for (let x = x0 + between(220, 320); x < x1 - 20; x += between(300, 360)) {
    add(`<rect x="${f(x)}" y="${y - 10}" width="12" height="${d + 20}" fill="#1e1c1a"/>`);
    add(`<rect x="${f(x - 6)}" y="${y - 14}" width="24" height="6" fill="#2a2724"/>`);
    bolt(x + 6, y - 11);
  }
  drips(x0, x1, y + d, Math.round((x1 - x0) / 75), 170);
}

function vPipe(x, d, y0 = 0, y1 = H) {
  add(`<rect x="${x + d * 0.5}" y="${y0}" width="${d}" height="${y1 - y0}" fill="#000" fill-opacity="0.6" filter="url(#shadow)"/>`);
  add(`<rect x="${x}" y="${y0}" width="${d}" height="${y1 - y0}" fill="url(#pipeV)"/>`);
  rusted(`<rect x="${x}" y="${y0}" width="${d}" height="${y1 - y0}"/>`);
  for (let y = y0 + between(60, 160); y < y1 - 20; y += between(420, 560)) {
    add(`<rect x="${x - 4}" y="${f(y)}" width="${d + 8}" height="16" rx="2" fill="url(#pipeV)"/>`);
    add(`<rect x="${x - 4}" y="${f(y)}" width="${d + 8}" height="16" rx="2" fill="#000" fill-opacity="0.3"/>`);
    drips(x, x + d, y + 16, 2, 120, 0.9);
  }
  for (let y = y0 + between(200, 300); y < y1 - 20; y += between(320, 380)) {
    add(`<rect x="${x - 12}" y="${f(y)}" width="${d + 24}" height="12" fill="#1e1c1a"/>`);
    bolt(x - 6, y + 6);
    bolt(x + d + 6, y + 6);
  }
}

function valve(cx, cy) {
  add(`<circle cx="${cx + 4}" cy="${cy + 6}" r="40" fill="#000" fill-opacity="0.5" filter="url(#shadow)"/>`);
  add(`<circle cx="${cx}" cy="${cy}" r="34" fill="none" stroke="#5c1f14" stroke-width="7"/>`);
  add(`<circle cx="${cx}" cy="${cy}" r="34" fill="none" stroke="#000" stroke-width="7" filter="url(#rust)"/>`);
  for (let a = 0; a < 3; a++) {
    const t = (a * Math.PI) / 3 + 0.3;
    add(`<line x1="${f(cx - Math.cos(t) * 32)}" y1="${f(cy - Math.sin(t) * 32)}" x2="${f(cx + Math.cos(t) * 32)}" y2="${f(cy + Math.sin(t) * 32)}" stroke="#4a1a11" stroke-width="5"/>`);
  }
  add(`<circle cx="${cx}" cy="${cy}" r="8" fill="#3a3632"/>`);
}

// Rubber-sheathed cables sagging between clips; each its own shade, slightly apart.
function cables(points, colours) {
  colours.forEach((c, i) => {
    const off = i * 7;
    let d = `M${points[0][0]},${points[0][1] + off}`;
    for (let k = 1; k < points.length; k++) {
      const [x0, y0] = points[k - 1];
      const [x1, y1] = points[k];
      const sag = Math.abs(x1 - x0) > 40 ? between(14, 26) : 0;
      d += ` Q${f((x0 + x1) / 2)},${f((y0 + y1) / 2 + off + sag)} ${x1},${y1 + off}`;
    }
    add(`<path d="${d}" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="7" transform="translate(4 7)" filter="url(#softer)"/>`);
    add(`<path d="${d}" fill="none" stroke="${c}" stroke-width="5.5" stroke-linecap="round"/>`);
    add(`<path d="${d}" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="1.2" transform="translate(-1 -1.6)"/>`);
  });
  for (const [x, y] of points.slice(1, -1)) {
    add(`<rect x="${x - 5}" y="${y - 5}" width="10" height="${colours.length * 7 + 6}" rx="2" fill="#2b2926"/>`);
    bolt(x, y - 1);
  }
}

function breakerPanel(x, y, w, h) {
  add(`<rect x="${x + 9}" y="${y + 12}" width="${w}" height="${h}" fill="#000" fill-opacity="0.6" filter="url(#shadow)"/>`);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#5a5d57"/>`);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="url(#blockLight)"/>`);
  // Door with a seam, hinges on the left and a latch on the right.
  add(`<rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${h - 16}" rx="2" fill="none" stroke="#000" stroke-opacity="0.5" stroke-width="1.5"/>`);
  add(`<rect x="${x + 9}" y="${y + 9}" width="${w - 18}" height="1" fill="#fff" fill-opacity="0.1"/>`);
  for (const hy of [y + 30, y + h - 46]) add(`<rect x="${x + 3}" y="${hy}" width="7" height="16" rx="1" fill="#2e2d2a"/>`);
  add(`<rect x="${x + w - 22}" y="${y + h / 2 - 18}" width="10" height="36" rx="3" fill="#232220"/>`);
  add(`<rect x="${x + w - 20}" y="${y + h / 2 - 16}" width="3" height="32" fill="#fff" fill-opacity="0.1"/>`);
  // Louvres along the bottom of the door.
  for (let ly = y + h - 56; ly < y + h - 20; ly += 9) add(`<rect x="${x + 26}" y="${ly}" width="${w - 60}" height="4" rx="1" fill="#141312"/>`);
  // A small yellow warning label with a lightning flash.
  const lx = x + w / 2 - 22;
  const ly = y + 34;
  add(`<polygon points="${lx + 22},${ly} ${lx + 46},${ly + 40} ${lx - 2},${ly + 40}" fill="#c9a51c"/>`);
  add(`<polygon points="${lx + 22},${ly + 6} ${lx + 40},${ly + 36} ${lx + 4},${ly + 36}" fill="none" stroke="#151412" stroke-width="2.5"/>`);
  add(`<path d="M${lx + 25},${ly + 13} l-7,12 h6 l-4,9 l9,-13 h-6 l4,-8 z" fill="#151412"/>`);
  add(`<rect x="${x + 22}" y="${y + 92}" width="${w - 44}" height="16" fill="#d8d2bd" fill-opacity="0.55"/>`);
  add(`<text x="${x + w / 2}" y="${y + 104}" text-anchor="middle" font-family="'Arial Narrow', Arial, sans-serif" font-weight="bold" font-size="11" letter-spacing="1" fill="#1a1917" fill-opacity="0.8">MAIN BREAKER</text>`);
  rusted(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>`);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="none" stroke="#0b0907" stroke-width="24" stroke-opacity="0.6" filter="url(#edgeGrime)"/>`);
  for (const [sx, sy] of [[x + 5, y + 5], [x + w - 5, y + 5], [x + 5, y + h - 5], [x + w - 5, y + h - 5]]) bolt(sx, sy);
  drips(x + 6, x + w - 6, y + h, 9, 150, 0.6);
}

function junctionBox(x, y, w, h, conduitTo) {
  add(`<rect x="${x + w / 2 - 7 + 6}" y="${conduitTo}" width="14" height="${y - conduitTo}" fill="#000" fill-opacity="0.5" filter="url(#shadow)"/>`);
  add(`<rect x="${x + w / 2 - 7}" y="${conduitTo}" width="14" height="${y - conduitTo}" fill="url(#pipeV)"/>`);
  rusted(`<rect x="${x + w / 2 - 7}" y="${conduitTo}" width="14" height="${y - conduitTo}"/>`);
  add(`<rect x="${x + 8}" y="${y + 10}" width="${w}" height="${h}" fill="#000" fill-opacity="0.55" filter="url(#shadow)"/>`);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#4d5149"/>`);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="url(#blockLight)"/>`);
  add(`<rect x="${x + 10}" y="${y + 10}" width="${w - 20}" height="${h - 20}" rx="2" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="2"/>`);
  rusted(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>`);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="none" stroke="#0b0907" stroke-width="22" stroke-opacity="0.6" filter="url(#edgeGrime)"/>`);
  for (const [sx, sy] of [[x + 9, y + 9], [x + w - 9, y + 9], [x + 9, y + h - 9], [x + w - 9, y + h - 9]]) bolt(sx, sy);
  drips(x, x + w, y + h, 6, 120, 0.6);
}

function vent(x, y, w, h) {
  add(`<rect x="${x + 6}" y="${y + 8}" width="${w}" height="${h}" fill="#000" fill-opacity="0.5" filter="url(#shadow)"/>`);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#3c3a36"/>`);
  for (let sy = y + 12; sy < y + h - 10; sy += 12) {
    add(`<rect x="${x + 10}" y="${sy}" width="${w - 20}" height="7" fill="#0e0d0c"/>`);
    add(`<rect x="${x + 10}" y="${sy + 7}" width="${w - 20}" height="2" fill="#fff" fill-opacity="0.07"/>`);
  }
  rusted(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>`);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="none" stroke="#000" stroke-opacity="0.6" stroke-width="16" filter="url(#edgeGrime)"/>`);
  for (const [sx, sy] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]]) bolt(sx, sy);
  // Soot blown out of the vent onto the wall above it.
  add(`<ellipse cx="${x + w / 2}" cy="${y - 20}" rx="${w * 0.6}" ry="60" fill="#0a0908" fill-opacity="0.5" filter="url(#sooty)"/>`);
  drips(x + 10, x + w - 10, y + h, 8, 140);
}

// An enamel sign screwed to the wall, faded, chipped and streaked with rust from its screws.
function warningSign(x, y, w, h, tilt) {
  add(`<g transform="rotate(${tilt} ${x + w / 2} ${y + h / 2})">`);
  add(`<rect x="${x + 6}" y="${y + 9}" width="${w}" height="${h}" fill="#000" fill-opacity="0.55" filter="url(#shadow)"/>`);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#b8961f"/>`);
  add(`<rect x="${x + 6}" y="${y + 6}" width="${w - 12}" height="${h - 12}" rx="2" fill="none" stroke="#1a1816" stroke-width="3"/>`);
  add(`<rect x="${x + 6}" y="${y + 6}" width="${w - 12}" height="34" fill="#1a1816"/>`);
  add(`<text x="${x + w / 2}" y="${y + 33}" text-anchor="middle" font-family="Impact, 'Arial Narrow', sans-serif" font-size="26" letter-spacing="3" fill="#b8961f">DANGER</text>`);
  const tx = x + 40;
  const ty = y + 54;
  add(`<polygon points="${tx},${ty} ${tx + 34},${ty + 58} ${tx - 34},${ty + 58}" fill="none" stroke="#1a1816" stroke-width="5" stroke-linejoin="round"/>`);
  add(`<path d="M${tx + 4},${ty + 16} l-11,19 h9 l-6,15 l14,-21 h-9 l6,-13 z" fill="#1a1816"/>`);
  add(`<text x="${x + 86}" y="${y + 80}" font-family="Impact, 'Arial Narrow', sans-serif" font-size="22" fill="#1a1816">HIGH</text>`);
  add(`<text x="${x + 86}" y="${y + 104}" font-family="Impact, 'Arial Narrow', sans-serif" font-size="22" fill="#1a1816">VOLTAGE</text>`);
  add(`<text x="${x + w / 2}" y="${y + h - 16}" text-anchor="middle" font-family="'Arial Narrow', Arial, sans-serif" font-weight="bold" font-size="11" letter-spacing="1" fill="#1a1816">AUTHORISED PERSONNEL ONLY</text>`);
  // Enamel chipped off down to the dark steel, then grime and rust over everything.
  for (let i = 0; i < 9; i++) {
    const cx = rand() < 0.6 ? (rand() < 0.5 ? x + between(0, 18) : x + w - between(0, 18)) : x + between(0, w);
    const cy = rand() < 0.5 ? y + between(0, 14) : y + h - between(0, 14);
    add(`<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(between(3, 9))}" ry="${f(between(2, 6))}" fill="#2a2420"/>`);
  }
  rusted(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>`);
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#0b0907" fill-opacity="0.18"/>`);
  for (const [sx, sy] of [[x + 12, y + 12], [x + w - 12, y + 12], [x + 12, y + h - 12], [x + w - 12, y + h - 12]]) bolt(sx, sy);
  add(`</g>`);
  for (const sx of [x + 12, x + w - 12]) add(`<rect x="${sx - 2}" y="${y + h - 6}" width="${f(between(3, 5))}" height="${f(between(50, 110))}" fill="url(#dripRust)" filter="url(#softer)"/>`);
}

// Layout. The notes sit at the top centre of the screen, which is the tile's top centre.
cables([[0, 368], [260, 362], [560, 366], [900, 362], [1150, 366], [1600, 368]], ["#1d1c1a", "#2a2623", "#3b2a1c"]);
hPipe(470, 42);
hPipe(526, 20);
vPipe(1210, 36);
valve(1228, 980);
hPipe(1236, 28, 0, 1210); // a lower return pipe that ends in the riser
vPipe(96, 24, 526 + 20, 1236); // a drop between the two runs
breakerPanel(232, 690, 150, 210);
cables([[307, 900], [307, 1000], [420, 1010], [560, 1004], [640, 1010]], ["#1d1c1a", "#2b2724"]);
junctionBox(640, 980, 110, 130, 546);
warningSign(1290, 640, 230, 150, 1.4);
vent(1330, 1040, 190, 120);
drips(0, W, 0, 30, 110);
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
<filter id="rust"><feTurbulence type="fractalNoise" baseFrequency="0.03 0.06" numOctaves="4" seed="31"/><feColorMatrix values="0 0 0 0 0.34 0 0 0 0 0.15 0 0 0 0 0.06 1.7 0 0 0 -0.92"/><feComposite in2="SourceGraphic" operator="in"/></filter>
<filter id="stencil"><feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed="9"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2.2 0 0 0 -0.7"/><feComposite in="SourceGraphic" operator="in"/></filter>
</defs>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}${out.join("")}</svg>`;
writeFileSync("public/bunker-wall.svg", svg);
console.log(`public/bunker-wall.svg: ${rows.length} rows, ${rows.reduce((n, r) => n + r.blocks.length, 0)} blocks, ${(svg.length / 1024).toFixed(0)} KB`);
