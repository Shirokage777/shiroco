// iPhone, started from the home screen (Sean, iPhone 11, 2026-11-13): right after launch iOS
// reports the visible height (100dvh) too short, by about the home bar's height, and corrects it
// only after the first scroll; the page, sized to that height, left a bar at the bottom. So on a
// phone in full screen the page is sized to the phone's real screen instead: SCREEN_HEIGHT_SCRIPT
// runs in the page head before the first paint and sets --screen-h, which the page and the login
// use (page.module.css, login.module.css). The iPad and every normal browser tab are left alone.

// Phones only (the narrow side under 600px in either orientation), and only full screen.
// Keep the CSS media queries the same (tests/full-screen.test.ts checks).
export const PHONE_FULL_SCREEN =
  "(display-mode: standalone) and (max-width: 600px), (display-mode: standalone) and (max-height: 600px)";

// The phone's screen height in the current orientation, in CSS pixels. iOS keeps screen.width and
// screen.height in portrait terms, so the longer side is the height when upright.
export function screenHeight(screen: { width: number; height: number }, portrait: boolean): number {
  const long = Math.max(screen.width, screen.height);
  const short = Math.min(screen.width, screen.height);
  return portrait ? long : short;
}

// Inline in the head, so it runs before the first paint; again on every rotation.
export const SCREEN_HEIGHT_SCRIPT = `(function () {
  var full = window.matchMedia(${JSON.stringify(PHONE_FULL_SCREEN)});
  var screenHeight = ${screenHeight.toString()};
  function size() {
    var root = document.documentElement.style;
    if (!full.matches) return root.removeProperty("--screen-h");
    var portrait = window.matchMedia("(orientation: portrait)").matches;
    root.setProperty("--screen-h", screenHeight(window.screen, portrait) + "px");
  }
  size();
  window.addEventListener("resize", size);
  window.addEventListener("orientationchange", size);
})();`;
