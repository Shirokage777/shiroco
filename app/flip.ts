// Turns a note over as one sheet of paper that bends while it turns.
//
// The sheet is built from narrow panels joined edge to edge like hinges, out from the centre
// line in both directions. The whole sheet turns about the centre line; meanwhile every hinge
// bends a little, so the sheet bows into a curve mid-turn and flattens again at the end.
// Because neighbouring panels share their edge, the sheet stays closed: no gaps.
//
// flipOver   front to back in one go (the back is blank paper)
// turnAway   front to edge-on: the note leaves; the caller then swaps what is shown
// turnIn     edge-on to front: the newly shown note arrives, finishing the turn

const PANELS_PER_SIDE = 6;
const TURN_MS = 700;
const BEND_DEG = 7; // bend per hinge at its strongest
const EASE = "cubic-bezier(0.45, 0, 0.35, 1)";

type Step = { angle: number; bend: number; light: number };

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
  return el;
}

// Builds the sheet over `note`, hides the note, plays the steps, then calls `done`.
function turn(note: HTMLElement, steps: Step[], ms: number, easing: string, backClass: string | null, done: () => void) {
  const host = note.parentElement;
  if (!host) return done();
  const width = note.offsetWidth;
  const height = note.offsetHeight;
  const slice = width / (2 * PANELS_PER_SIDE);
  const timing: KeyframeAnimationOptions = { duration: ms, easing, fill: "forwards" };

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
      const faces = [face(note.cloneNode(true) as HTMLElement, offsetX, slice, width, height, false)];
      if (backClass) {
        const back = document.createElement("div");
        back.className = backClass;
        faces.push(face(back, offsetX, slice, width, height, true));
      }
      for (const f of faces) {
        // Paper turned away from the light darkens a little.
        f.animate(steps.map((s) => ({ filter: `brightness(${s.light})` })), timing);
        panel.append(f);
      }
      // Every hinge bends the same way, so the sheet bows into one smooth curve.
      panel.animate(steps.map((s) => ({ transform: `rotateY(${side * BEND_DEG * s.bend}deg)` })), timing);
      parent.append(panel);
      parent = panel;
    }
  }
  spine.animate(steps.map((s) => ({ transform: `rotateY(${s.angle}deg)` })), timing);

  note.style.visibility = "hidden";
  host.append(layer);
  window.setTimeout(() => {
    done();
    layer.remove();
    note.style.visibility = "";
  }, ms + 30);
}

export function flipOver(note: HTMLElement, paperClass: string, done: () => void) {
  const steps = [
    { angle: 0, bend: 0, light: 1 },
    { angle: -90, bend: 1, light: 0.75 },
    { angle: -180, bend: 0, light: 1 },
  ];
  turn(note, steps, TURN_MS, EASE, paperClass, done);
}

export function turnAway(note: HTMLElement, done: () => void) {
  const steps = [
    { angle: 0, bend: 0, light: 1 },
    { angle: -90, bend: 1, light: 0.75 },
  ];
  turn(note, steps, TURN_MS / 2, "ease-in", null, done);
}

export function turnIn(note: HTMLElement, done: () => void = () => {}) {
  const steps = [
    { angle: 90, bend: 1, light: 0.75 },
    { angle: 0, bend: 0, light: 1 },
  ];
  turn(note, steps, TURN_MS / 2, "ease-out", null, done);
}
