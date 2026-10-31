// Unfolds a card from the size of the folded note it was turned over from.
//
// The folded note shows `startHeight` of the card. Each fold doubles what is open, the last
// one opens the rest: the card is revealed step by step (clip) while a flap of paper (its
// back) swings down at each fold. Because every flap is as tall as what is open before it,
// the folded packet is fully covered by paper: no text shows until its fold opens.
// Done in script because the steps depend on two measured heights.

const STAGE_MS = 500;

const inset = (shown: number) => `inset(-24px -24px ${((1 - shown) * 100).toFixed(3)}% -24px)`;

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

  // The card: hold each opening until its fold has swung down, then show the next part.
  const keyframes: Keyframe[] = [];
  stops.slice(0, -1).forEach((shown, i) => {
    keyframes.push({ offset: i / stages, clipPath: inset(shown) });
    keyframes.push({ offset: (i + 1) / stages - 0.001, clipPath: inset(shown) });
  });
  keyframes.push({ offset: 1, clipPath: "inset(-24px)" });
  const reveal = card.animate(keyframes, { duration: total, fill: "both" });

  // The flaps: each starts folded up over what is already open and swings down over the
  // next part of the card, then gets out of the way.
  const flaps = stops.slice(0, -1).map((top, i) => {
    const flap = document.createElement("div");
    flap.className = flapClass;
    flap.setAttribute("aria-hidden", "true");
    Object.assign(flap.style, { top: `${top * 100}%`, height: `${(stops[i + 1] - top) * 100}%`, animation: "none", opacity: "0" });
    host.append(flap);
    flap.animate(
      [
        { opacity: 1, transform: "perspective(1400px) rotateX(178deg)" },
        { offset: 0.96, opacity: 1, transform: "perspective(1400px) rotateX(0deg)" },
        { opacity: 0, transform: "perspective(1400px) rotateX(0deg)" },
      ],
      // The first flap is already lying folded over the packet when the card appears.
      { duration: STAGE_MS, delay: i * STAGE_MS, easing: "ease-in-out", fill: i === 0 ? "both" : "forwards" },
    );
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
    cover.animate([{ opacity: 1 }, { offset: 0.5, opacity: 1 }, { opacity: 0 }], { duration: STAGE_MS, fill: "forwards" });
    flaps.push(cover);
  }

  // Afterwards nothing may linger: a finished script animation would override the CSS refold.
  reveal.finished.then(() => {
    reveal.cancel();
    flaps.forEach((f) => f.remove());
  });
}
