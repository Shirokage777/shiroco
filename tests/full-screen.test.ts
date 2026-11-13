import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PHONE_FULL_SCREEN, SCREEN_HEIGHT_SCRIPT, screenHeight } from "@/app/full-screen";

// Runs the inline head script against a fake phone and returns the --screen-h it sets.
function run(opts: { fullScreen: boolean; portrait: boolean; screen: { width: number; height: number } }) {
  const style = new Map<string, string>();
  const listeners: string[] = [];
  const window = {
    matchMedia: (q: string) => ({ matches: q === PHONE_FULL_SCREEN ? opts.fullScreen : opts.portrait }),
    screen: opts.screen,
    addEventListener: (event: string) => listeners.push(event),
  };
  const document = {
    documentElement: {
      style: { setProperty: (k: string, v: string) => style.set(k, v), removeProperty: (k: string) => style.delete(k) },
    },
  };
  new Function("window", "document", SCREEN_HEIGHT_SCRIPT)(window, document);
  return { value: style.get("--screen-h"), listeners };
}

const iPhone11 = { width: 414, height: 896 };

describe("iPhone full screen: the page fills the real screen, no bar at the bottom", () => {
  it("sizes the page to an iPhone 11's screen at launch, upright and on its side", () => {
    expect(run({ fullScreen: true, portrait: true, screen: iPhone11 }).value).toBe("896px");
    expect(run({ fullScreen: true, portrait: false, screen: iPhone11 }).value).toBe("414px");
    expect(run({ fullScreen: true, portrait: true, screen: iPhone11 }).listeners).toEqual(["resize", "orientationchange"]);
  });

  it("leaves the iPad and browser tabs alone", () => {
    expect(run({ fullScreen: false, portrait: true, screen: iPhone11 }).value).toBeUndefined();
  });

  it("takes the longer screen side as the height when upright", () => {
    expect(screenHeight({ width: 896, height: 414 }, true)).toBe(896);
    expect(screenHeight({ width: 414, height: 896 }, false)).toBe(414);
  });

  it("uses that height in the page and the login, with the same phone-only rule", () => {
    for (const file of ["app/page.module.css", "app/login/login.module.css"]) {
      const css = readFileSync(file, "utf8");
      expect(css, file).toContain(`@media ${PHONE_FULL_SCREEN} {`);
      expect(css, file).toContain("min-height: var(--screen-h, 100vh);");
    }
    expect(readFileSync("app/globals.css", "utf8")).toContain(`@media ${PHONE_FULL_SCREEN} {`);
  });
});
