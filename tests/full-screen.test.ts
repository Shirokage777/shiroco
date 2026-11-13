import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { PHONE_FULL_SCREEN, settleFullScreen } from "@/app/full-screen";

const fakeWindow = (matches: boolean, scrollY = 0) => {
  const frames: (() => void)[] = [];
  return {
    matchMedia: vi.fn(() => ({ matches }) as MediaQueryList),
    scrollTo: vi.fn(),
    requestAnimationFrame: vi.fn((cb: FrameRequestCallback) => (frames.push(() => cb(0)), 1)),
    scrollY,
    frames,
  };
};

describe("iPhone full screen: no white bar at the bottom", () => {
  it("nudges the page one pixel and back on a phone started from the home screen", () => {
    const win = fakeWindow(true);
    expect(settleFullScreen(win as never)).toBe(true);
    expect(win.matchMedia).toHaveBeenCalledWith(PHONE_FULL_SCREEN);
    expect(win.scrollTo).toHaveBeenLastCalledWith(0, 1);
    win.frames.forEach((f) => f());
    expect(win.scrollTo).toHaveBeenLastCalledWith(0, 0);
  });

  it("leaves the iPad, browser tabs and a scrolled page alone", () => {
    for (const win of [fakeWindow(false), fakeWindow(true, 200)]) {
      expect(settleFullScreen(win as never)).toBe(false);
      expect(win.scrollTo).not.toHaveBeenCalled();
    }
  });

  it("matches phones only, in full screen, in either orientation", () => {
    expect(PHONE_FULL_SCREEN).toBe(
      "(display-mode: standalone) and (max-width: 600px), (display-mode: standalone) and (max-height: 600px)",
    );
  });

  it("paints the wall, never white, behind the strip, with the same phone-only rule", () => {
    for (const file of ["app/globals.css", "app/page.module.css"]) {
      expect(readFileSync(file, "utf8"), file).toContain(`@media ${PHONE_FULL_SCREEN} {`);
    }
  });
});
