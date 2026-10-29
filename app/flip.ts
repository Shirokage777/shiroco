// Turns a note over as one sheet of paper that bends while it turns.
//
// The sheet is built from narrow panels joined edge to edge like hinges, out from the centre
// line in both directions. The whole sheet turns about the centre line; meanwhile every hinge
// bends a little, so the sheet bows into a curve mid-turn and flattens again at the end.
// Because neighbouring panels share their edge, the sheet stays closed: no gaps.
// Each panel has a front (a slice of the note) and a back (blank paper), so the back
// comes round on its own as the sheet turns.

const PANELS_PER_SIDE = 6;
const TURN_MS = 700;
const BEND_DEG = 7; // extra bend per hinge at mid-turn

const timing: KeyframeAnimationOptions = { duration: TURN_MS, easing: "cubic-bezier(0.45, 0, 0.35, 1)", fill: "forwards" };

// One side of a panel, showing the slice of `content` that lies under the panel.
function face(content: HTMLElement, offsetX: number, slice: number, width: number, height: number, back: boolean) {
  const el = document.createElement("div");
  Object.assign(el.style, {
    position: "absolute",
    inset: "0 -0.5px", // a hair of overlap so no seam shows at the hinges
    overflow: "hidden",
    backfaceVisibility: "hidden",
    transform: back ? "rotateY(180deg)" : "",
  });
  // The back is seen mirrored, so it shows the slice from the opposite side of the sheet.
  const sliceX = back ? width - offsetX - slice : offsetX;
  Object.assign(content.style, { position: "absolute", left: `${-sliceX}px`, top: "0", width: `${width}px`, height: `${height}px`, margin: "0", animation: "none" });
  el.append(content);
  // Paper turned away from the light darkens a little.
  el.animate([{ filter: "brightness(1)" }, { filter: "brightness(0.75)" }, { filter: "brightness(1)" }], timing);
  return el;
}

export function flipOver(note: HTMLElement, paperClass: string, done: () => void) {
  const host = note.parentElement;
  if (!host) return done();
  const width = note.offsetWidth;
  const height = note.offsetHeight;
  const slice = width / (2 * PANELS_PER_SIDE);

  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, {
    position: "absolute",
    left: `${note.offsetLeft}px`,
    top: `${note.offsetTop}px`,
    width: `${width}px`,
    height: `${height}px`,
    zIndex: "3",
    pointerEvents: "none",
    perspective: "1100px",
    transformStyle: "preserve-3d",
  });

  // The centre line of the sheet: turning it turns the whole sheet.
  const spine = document.createElement("div");
  Object.assign(spine.style, { position: "absolute", left: `${width / 2}px`, top: "0", width: "0", height: `${height}px`, transformStyle: "preserve-3d" });
  layer.append(spine);

  for (const side of [1, -1]) {
    let parent = spine;
    for (let k = 0; k < PANELS_PER_SIDE; k++) {
      // Right side: each panel hangs off its parent's right edge; left side: off its left edge.
      const panel = document.createElement("div");
      Object.assign(panel.style, {
        position: "absolute",
        top: "0",
        left: side === 1 ? (k === 0 ? "0" : `${slice}px`) : `${-slice}px`,
        width: `${slice}px`,
        height: `${height}px`,
        transformStyle: "preserve-3d",
        transformOrigin: side === 1 ? "0 50%" : "100% 50%",
      });
      const offsetX = side === 1 ? width / 2 + k * slice : width / 2 - (k + 1) * slice;
      const back = document.createElement("div");
      back.className = paperClass;
      panel.append(face(note.cloneNode(true) as HTMLElement, offsetX, slice, width, height, false), face(back, offsetX, slice, width, height, true));
      // Every hinge bends the same way, so the sheet bows into one smooth curve and back.
      panel.animate([{ transform: "rotateY(0deg)" }, { transform: `rotateY(${side * BEND_DEG}deg)` }, { transform: "rotateY(0deg)" }], timing);
      parent.append(panel);
      parent = panel;
    }
  }

  spine.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(-180deg)" }], timing);

  note.style.visibility = "hidden";
  host.append(layer);
  window.setTimeout(() => {
    done();
    layer.remove();
    note.style.visibility = "";
  }, TURN_MS + 30);
}
