// iPhone, started from the home screen: right after launch (and after coming back from the
// background) iOS lays the full-screen page out a little short at the bottom, by about the home
// bar's height, until the first scroll; the strip below showed white (Sean, iPhone 11, 2026-11-13).
// A one-pixel scroll and back, as a finger would, makes iOS lay it out properly at once. The iPad
// does not do this and is left alone, and so is every normal browser tab.

// Phones only (the narrow side under 600px in either orientation), and only full screen.
export const PHONE_FULL_SCREEN =
  "(display-mode: standalone) and (max-width: 600px), (display-mode: standalone) and (max-height: 600px)";

type Win = Pick<Window, "matchMedia" | "scrollTo" | "requestAnimationFrame" | "scrollY">;

export function settleFullScreen(win: Win): boolean {
  if (!win.matchMedia(PHONE_FULL_SCREEN).matches || win.scrollY !== 0) return false;
  win.scrollTo(0, 1);
  win.requestAnimationFrame(() => win.scrollTo(0, 0));
  return true;
}
