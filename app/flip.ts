// Turns a note over so the paper bends instead of flipping like a board.
//
// The note is cut into narrow vertical strips (copies of the note, each showing one slice).
// All strips turn about the note's centre line, but each starts a little later than its
// neighbour on the right, so mid-turn they fan out like a sheet curving as it is turned over.
// At edge-on each strip swaps its front for blank paper, then comes round showing the back.

const STRIPS = 12;
const HALF_MS = 260; // one strip: front to edge-on, then edge-on to back
const STAGGER_MS = 22; // delay between neighbouring strips

export const FLIP_TOTAL_MS = 2 * HALF_MS + (STRIPS - 1) * STAGGER_MS;

export function flipOver(note: HTMLElement, paperClass: string, done: () => void) {
  const host = note.parentElement;
  if (!host) return done();
  const width = note.offsetWidth;
  const height = note.offsetHeight;
  const slice = width / STRIPS;

  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, { position: "absolute", left: `${note.offsetLeft}px`, top: `${note.offsetTop}px`, width: `${width}px`, height: `${height}px`, zIndex: "3", pointerEvents: "none" });

  for (let i = 0; i < STRIPS; i++) {
    const strip = document.createElement("div");
    Object.assign(strip.style, { position: "absolute", left: `${i * slice}px`, top: "0", width: `${slice + 1.5}px`, height: "100%", overflow: "hidden" });
    // Turn about the note's centre line, not the strip's own centre.
    strip.style.transformOrigin = `${width / 2 - i * slice}px 50%`;

    const front = note.cloneNode(true) as HTMLElement;
    Object.assign(front.style, { position: "absolute", left: `${-i * slice}px`, top: "0", width: `${width}px`, height: `${height}px`, margin: "0", animation: "none" });
    const back = document.createElement("div");
    back.className = paperClass;
    Object.assign(back.style, { position: "absolute", left: `${-i * slice}px`, top: "0", width: `${width}px`, height: `${height}px`, visibility: "hidden" });
    strip.append(front, back);
    layer.append(strip);

    // The right edge leads, the left edge trails: that lag is the curve.
    const delay = (STRIPS - 1 - i) * STAGGER_MS;
    const shade = (a: number) => `brightness(${a})`;
    const out = strip.animate(
      [
        { transform: "perspective(900px) rotateY(0deg)", filter: shade(1) },
        { transform: "perspective(900px) rotateY(90deg)", filter: shade(0.7) },
      ],
      { duration: HALF_MS, delay, easing: "ease-in", fill: "forwards" },
    );
    out.onfinish = () => {
      front.style.visibility = "hidden";
      back.style.visibility = "visible";
      strip.animate(
        [
          { transform: "perspective(900px) rotateY(-90deg)", filter: shade(0.7) },
          { transform: "perspective(900px) rotateY(0deg)", filter: shade(1) },
        ],
        { duration: HALF_MS, easing: "ease-out", fill: "forwards" },
      );
    };
  }

  note.style.visibility = "hidden";
  host.append(layer);
  window.setTimeout(() => {
    done();
    layer.remove();
    note.style.visibility = "";
  }, FLIP_TOTAL_MS + 30);
}
