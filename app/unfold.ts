// Unfolds a card from the size of the folded note it was turned over from.
//
// The folded note shows `startHeight` of the card. Each fold doubles what is open, the last
// one opens the rest: the card is revealed step by step (clip) while a flap of paper (its
// back) swings down at each fold. Because every flap is as tall as what is open before it,
// the folded packet is fully covered by paper: no text shows until its fold opens.
// Done in script because the steps depend on two measured heights.

import { foldLine, tornClipPath, tornEdgeImage } from "./torn-edge";

const STAGE_MS = 500;

// Clips are switched by timer at each fold, never animated: Chrome draws clip-path animations on
// the graphics chip, and on a screen scaled to a fraction (125 %, 135 %, ...) it made the clip too
// small, cutting the card off on the right and at the bottom while it moved.
const unfolding = new WeakMap<HTMLElement, { timers: number[]; flaps: HTMLElement[] }>();

// Stops an unfold still running on this card (Done pressed before it finished).
export function cancelUnfold(card: HTMLElement) {
  const run = unfolding.get(card);
  if (!run) return;
  run.timers.forEach((t) => window.clearTimeout(t));
  run.flaps.forEach((f) => f.remove());
  card.style.clipPath = "";
  unfolding.delete(card);
}

// Fold lines are rough (foldLine), and the same fold always gets the same line, so the card's
// cut and the flap swinging on that fold match. Positions in px, y measured on the card.
const fold = (w: number, y: number) => foldLine(w, y, Math.round(y) + 1);
const pts = (p: [number, number][]) => p.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(",");

// What is open of the card above the fold at y.
export function above(w: number, y: number) {
  return `polygon(-24px -24px,${w + 24}px -24px,${pts(fold(w, y).reverse())})`;
}

// A slice of the card between two folds, in the slice's own frame. A flap turns over on its top
// fold, which mirrors a rough edge there, so it could not meet the card's cut both before and
// after turning. Instead that edge reaches past the fold by as much as the line wobbles: it
// always overlaps the card, never leaves a gap, and the outline stays rough. `cut`: where the
// slice's far half starts (the refold folds it there next), overlapping the same way.
function band(w: number, top: number, height: number, cut = 0) {
  const hinge = fold(w, top - cut).map(([x, y]): [number, number] => [x, cut - Math.abs(y - (top - cut))]);
  const far = fold(w, top + height).map(([x, y]): [number, number] => [x, y - top]);
  return `polygon(${pts(hinge)},${pts(far.reverse())})`;
}

// Gives a flap the card's torn paper (table.module.css, .flap::before): the card's outline and
// dirt (set by torn-edges.tsx), and where the flap's slice lies on the card.
// A card that has only just appeared may not have its outline yet: then it is worked out here,
// the same way torn-edges.tsx does.
export function matchCard(flap: HTMLElement, card: HTMLElement) {
  const { width: w, height: h } = card.getBoundingClientRect();
  flap.style.setProperty("--torn", card.style.getPropertyValue("--torn") || tornClipPath(w, h));
  flap.style.setProperty("--edge", card.style.getPropertyValue("--edge") || tornEdgeImage(w, h));
  const top = flap.offsetTop - card.offsetTop;
  const fh = flap.offsetHeight;
  flap.style.setProperty("--slice-top", `${top}px`);
  flap.style.setProperty("--card-h", `${card.offsetHeight}px`);
  // The slice between its two folds, and (for the refold) its far half, cut at the next fold.
  flap.style.setProperty("--band", band(w, top, fh));
  flap.style.setProperty("--band-half", band(w, top, fh, fh / 2));
}


export function unfold(card: HTMLElement, startHeight: number, flapClass: string) {
  const host = card.parentElement;
  const height = card.offsetHeight;
  if (!host || !height) return;
  const start = Math.min(1, startHeight / height);
  const stops = [start];
  while (stops[stops.length - 1] * 2 < 0.97) stops.push(stops[stops.length - 1] * 2);
  stops.push(1);
  const stages = stops.length - 1;
  const total = stages * STAGE_MS;
  const width = card.offsetWidth;

  // The card: hold each opening until its fold has swung down, then show the next part (just
  // before the flap over it goes, so nothing shows through).
  card.style.clipPath = above(width, start * height);
  const timers = stops.slice(1).map((shown, i) =>
    window.setTimeout(() => {
      card.style.clipPath = shown >= 1 ? "" : above(width, shown * height);
    }, (i + 1) * STAGE_MS - 15),
  );

  // The flaps: each starts folded up over what is already open and swings down over the
  // next part of the card, then gets out of the way.
  const flaps = stops.slice(0, -1).map((top, i) => {
    const flap = document.createElement("div");
    flap.className = flapClass;
    flap.setAttribute("aria-hidden", "true");
    Object.assign(flap.style, { top: `${top * 100}%`, height: `${(stops[i + 1] - top) * 100}%`, animation: "none", opacity: "0" });
    host.append(flap);
    matchCard(flap, card);
    // The first flap is already lying folded over the packet when the card appears.
    const timing: KeyframeAnimationOptions = { duration: STAGE_MS, delay: i * STAGE_MS, fill: i === 0 ? "both" : "forwards" };
    // It swings down for the whole stage and lands as the stage ends...
    flap.animate(
      [
        { transform: "perspective(1400px) rotateX(178deg)", easing: "ease-in-out" },
        { transform: "perspective(1400px) rotateX(0deg)" },
      ],
      timing,
    );
    // ...and goes only then, the moment the card shows the part it covered: never a see-through
    // gap (with the easing on the whole stage, it used to fade while the card was still closed).
    flap.animate([{ opacity: 1 }, { offset: 0.999, opacity: 1 }, { opacity: 0 }], timing);
    return flap;
  });

  // A short last fold (card under twice the note) cannot cover the whole packet: blank
  // paper covers the rest of it until that fold has opened.
  const firstFlap = stops[1] - stops[0];
  if (firstFlap < start) {
    const cover = document.createElement("div");
    cover.className = flapClass;
    cover.setAttribute("aria-hidden", "true");
    Object.assign(cover.style, { top: "0", height: `${(start - firstFlap) * 100}%`, animation: "none", opacity: "1", transform: "none" });
    host.append(cover);
    matchCard(cover, card);
    cover.animate([{ opacity: 1 }, { offset: 0.5, opacity: 1 }, { opacity: 0 }], { duration: STAGE_MS, fill: "forwards" });
    flaps.push(cover);
  }

  // Afterwards nothing may linger.
  timers.push(window.setTimeout(() => cancelUnfold(card), total + 30));
  unfolding.set(card, { timers, flaps });
}
