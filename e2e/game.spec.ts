import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_PASSWORD, E2E_USER } from "../playwright.config";

// A whole game, in each browser engine and screen size of playwright.config.ts. After every step
// the screen is checked: nothing sticks out sideways, and every button is big enough to tap.

const MIN_TAP = 40; // px, smallest comfortable tap target (Apple recommends 44)

// Waits until the button can be seen, then presses it. Playwright would also wait for a few
// steady frames, but Safari's engine on Windows draws in software at a few frames a second, so
// that wait times out for no fault of the app (a real iPhone draws with its graphics chip).
async function press(target: Locator) {
  await expect(target).toBeVisible();
  await target.click({ force: true });
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Name").fill(E2E_USER);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await press(page.getByRole("button", { name: "Enter", exact: true }));
  await expect(page.getByRole("button", { name: /Start game/ })).toBeVisible();
}

// Nothing wider than the screen, and every visible button large enough for a finger.
async function checkScreen(page: Page, where: string) {
  const layout = await page.evaluate((minTap) => {
    const doc = document.scrollingElement!;
    const small = [...document.querySelectorAll("button, input, [role=switch]")]
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ el, box }) => {
        const tall = el.getAttribute("type") === "checkbox" ? box.height >= 20 : box.height >= minTap;
        return !tall || box.width < (el.getAttribute("type") === "checkbox" ? 20 : minTap);
      })
      .map(({ el, box }) => `${(el.textContent || el.getAttribute("aria-label") || el.getAttribute("name") || el.tagName).trim().slice(0, 30)} ${Math.round(box.width)}x${Math.round(box.height)}`);
    return { overflow: doc.scrollWidth - doc.clientWidth, small };
  }, MIN_TAP);
  expect.soft(layout.overflow, `${where}: page scrolls sideways`).toBeLessThanOrEqual(1);
  expect.soft(layout.small, `${where}: buttons too small to tap`).toEqual([]);
}

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}

test("the login page names nothing about the game", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("body")).not.toContainText(/dead of winter|crossroads|zombie|survivor|colony/i);
  await checkScreen(page, "login");
});

test("a full game: draw, reveal, choose, change your mind, done", async ({ page }) => {
  const errors = watchErrors(page);
  await login(page);
  await checkScreen(page, "setup");

  await press(page.getByRole("button", { name: /Start game/ }));
  await press(page.getByRole("button", { name: "Draw card", exact: true }));
  await expect(page.getByRole("button", { name: "Triggered", exact: true })).toBeVisible();
  await checkScreen(page, "trigger note");

  // Not triggered: back to the draw note, one card discarded.
  await press(page.getByRole("button", { name: "Not Triggered" }));
  await expect(page.getByText(/1 discarded/)).toBeVisible();
  await press(page.getByRole("button", { name: "Draw card", exact: true }));

  await press(page.getByRole("button", { name: "Triggered", exact: true }));
  await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
  const options = page.locator("[aria-pressed]");
  expect(await options.count()).toBeGreaterThan(0);
  const done = page.getByRole("button", { name: "Done", exact: true });
  await expect(done).toBeHidden();
  await checkScreen(page, "revealed card");

  // Choose, undo, choose again: Done comes and goes, the card never changes size.
  const card = page.locator("article");
  const height = (await card.boundingBox())!.height;
  await press(options.first());
  await expect(done).toBeVisible();
  await expect(options.first()).toHaveAttribute("aria-pressed", "true");
  expect((await card.boundingBox())!.height).toBeCloseTo(height, 0);
  await press(options.first());
  await expect(done).toBeHidden();
  await press(options.first());
  await checkScreen(page, "option chosen");

  await press(done);
  await expect(page.getByRole("button", { name: "Draw card", exact: true })).toBeVisible();
  await expect(page.getByText(/2 discarded/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("New game and Sign out ask first, and Cancel keeps playing", async ({ page }) => {
  await login(page);
  await press(page.getByRole("button", { name: /Start game/ }));

  await press(page.getByRole("button", { name: "New game", exact: true }));
  await expect(page.getByRole("alertdialog", { name: "Start a new game?" })).toBeVisible();
  await checkScreen(page, "new game question");
  await press(page.getByRole("button", { name: "Cancel", exact: true }));
  await expect(page.getByRole("button", { name: "Draw card", exact: true })).toBeVisible();
  await press(page.getByRole("button", { name: "New game", exact: true }));
  await press(page.getByRole("button", { name: "Yes, new game" }));
  await expect(page.getByRole("button", { name: /Start game/ })).toBeVisible();

  await press(page.getByRole("button", { name: "Sign out", exact: true }));
  await expect(page.getByRole("alertdialog", { name: "Sign out?" })).toBeVisible();
  await checkScreen(page, "sign out question");
  await press(page.getByRole("button", { name: "Cancel", exact: true }));
  await expect(page.getByRole("button", { name: /Start game/ })).toBeVisible();
  await press(page.getByRole("button", { name: "Sign out", exact: true }));
  await press(page.getByRole("button", { name: "Yes, sign out" }));
  await expect(page).toHaveURL(/\/login$/);
});

test("the sound levers switch, stay switched, and narration and screams load", async ({ page }) => {
  const errors = watchErrors(page);
  await login(page);
  const levers = page.getByRole("switch");
  await expect(levers).toHaveCount(6);
  const lever = (name: string) => page.getByRole("switch", { name, exact: true });

  // Music and Intense music are linked: one switches the other off.
  await press(lever("Music"));
  await press(lever("Intense music"));
  await expect(lever("Intense music")).toHaveAttribute("aria-checked", "true");
  await expect(lever("Music")).toHaveAttribute("aria-checked", "false");
  await press(lever("Music"));
  await expect(lever("Music")).toHaveAttribute("aria-checked", "true");
  await expect(lever("Intense music")).toHaveAttribute("aria-checked", "false");
  await press(lever("Music"));

  for (const name of ["Narrate", "Ambience", "Music", "Zombies", "Screams"]) {
    await expect(lever(name)).toHaveAttribute("aria-checked", "false");
    await press(lever(name));
    await expect(lever(name)).toHaveAttribute("aria-checked", "true");
  }
  await page.reload();
  for (const name of ["Narrate", "Ambience", "Music", "Zombies", "Screams"]) {
    await expect(lever(name)).toHaveAttribute("aria-checked", "true");
  }
  await expect(lever("Intense music")).toHaveAttribute("aria-checked", "false");

  await press(page.getByRole("button", { name: /Start game/ }));
  await press(page.getByRole("button", { name: "Draw card", exact: true }));
  // The Windows build of Safari's engine has no Web Audio (real Safari does), so the app plays
  // nothing there; only browsers that can play check that the narration loads.
  if (await page.evaluate(() => "AudioContext" in window)) {
    // Screams were left on: the first one comes within seconds of the first tap after the reload.
    const screamed = page.waitForResponse((r) => /\/sounds\/scream-\d-\d+\.mp3$/.test(r.url()), { timeout: 15_000 });
    const narration = page.waitForResponse((r) => /\/api\/narration\/[^/]+\/text$/.test(r.url()));
    await press(page.getByRole("button", { name: "Triggered", exact: true }));
    expect((await narration).status()).toBe(200);
    expect((await screamed).status()).toBe(200);
  } else {
    await press(page.getByRole("button", { name: "Triggered", exact: true }));
  }

  // Switch everything off again: the next visitor of this browser starts in silence.
  for (const name of ["Narrate", "Ambience", "Music", "Zombies", "Screams"]) await press(lever(name));
  expect(errors).toEqual([]);
});

// The browser's audio engine is watched through every AudioContext the page creates.
test("sound pauses when the phone locks, comes back, and stops on sign out", async ({ page }) => {
  test.skip(!(await page.evaluate(() => "AudioContext" in window)), "this browser build has no Web Audio");
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    const made: AudioContext[] = [];
    (window as unknown as { __audio: AudioContext[] }).__audio = made;
    window.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) {
        super(options);
        made.push(this);
      }
    };
  });
  const state = () => page.evaluate(() => (window as unknown as { __audio: AudioContext[] }).__audio.map((c) => c.state).join());
  const setHidden = (hidden: boolean) =>
    page.evaluate((h) => {
      Object.defineProperty(document, "hidden", { value: h, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    }, hidden);

  await login(page);
  await press(page.getByRole("switch", { name: "Ambience" }));
  await expect.poll(state).toBe("running");

  await setHidden(true); // phone locked
  await expect.poll(state).toBe("suspended");
  await setHidden(false); // unlocked
  await expect.poll(state).toBe("running");

  await press(page.getByRole("button", { name: "Sign out", exact: true }));
  await press(page.getByRole("button", { name: "Yes, sign out" }));
  await expect(page).toHaveURL(/\/login$/);
  expect(await state()).toBe(""); // a fresh page: no audio engine left playing

  await page.goto("/");
  await login(page);
  await press(page.getByRole("switch", { name: "Ambience" })); // leave it off for the next run
});

// Intense music comes in at full volume at once, while the normal music fades in (Sean, 2026-11-07).
// Measured as the share of the raw recording that reaches the speakers, so the track's own loud and
// quiet parts don't count: a meter is tapped onto every clip and onto every output.
test("Intense music starts at full volume at once, the normal music fades in", async ({ page }, info) => {
  test.skip(info.project.name !== "chrome-laptop", "one engine is enough to measure the sound");
  await page.addInitScript(() => {
    const raw = new Map<BaseAudioContext, AnalyserNode>();
    const out = new Map<BaseAudioContext, AnalyserNode>();
    const meter = (all: Map<BaseAudioContext, AnalyserNode>, ctx: BaseAudioContext) => {
      let m = all.get(ctx);
      if (!m) all.set(ctx, (m = ctx.createAnalyser()));
      return m;
    };
    const connect = AudioNode.prototype.connect as (this: AudioNode, ...args: unknown[]) => unknown;
    AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
      if (args[0] instanceof AudioDestinationNode) connect.call(this, meter(out, this.context));
      if (this instanceof AudioBufferSourceNode) connect.call(this, meter(raw, this.context));
      return connect.apply(this, args);
    } as typeof AudioNode.prototype.connect;
    const rms = (m?: AnalyserNode) => {
      if (!m) return 0;
      const data = new Float32Array(m.fftSize);
      m.getFloatTimeDomainData(data);
      return Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
    };
    (window as unknown as { __share: () => number | null }).__share = () => {
      const [ctx] = raw.keys();
      const r = rms(raw.get(ctx));
      return r > 0.002 ? rms(out.get(ctx)) / r : null;
    };
  });
  // The average share over a stretch of time, from the moment the clip sounds.
  const share = async (ms: number) => {
    const seen: number[] = [];
    for (const end = Date.now() + ms; Date.now() < end || seen.length < 3; ) {
      const s = await page.evaluate(() => (window as unknown as { __share: () => number | null }).__share());
      if (s !== null) seen.push(s);
      if (Date.now() > end + 10_000) break;
    }
    expect(seen.length).toBeGreaterThan(2);
    return seen.reduce((a, b) => a + b, 0) / seen.length;
  };
  const lever = (name: string) => page.getByRole("switch", { name, exact: true });
  await login(page);

  // While Music is on, the intense track is loaded ahead.
  const intenseLoaded = page.waitForResponse((r) => r.url().endsWith("/api/music/zombie-music-intense2"));
  await press(lever("Music"));
  expect((await intenseLoaded).status()).toBe(200);
  await page.waitForTimeout(1000);
  await press(lever("Music"));
  await page.waitForTimeout(1800); // the music has faded out and stopped

  // Intense music: at full volume within its first 300 ms, as loud as seconds later.
  await press(lever("Intense music"));
  const intenseFirst = await share(300);
  await page.waitForTimeout(4000);
  const intenseLater = await share(1000);
  // Exactly its set level (0.5): the safety limiter on the output changes nothing at normal volume.
  expect(intenseLater).toBeGreaterThan(0.45);
  expect(intenseLater).toBeLessThan(0.55);
  expect(intenseFirst / intenseLater).toBeGreaterThan(0.85);
  await press(lever("Intense music"));
  await page.waitForTimeout(1800);

  // The normal music still fades in: much quieter at first than once it has settled.
  await press(lever("Music"));
  const musicFirst = await share(300);
  await page.waitForTimeout(4000);
  const musicLater = await share(1000);
  expect(musicFirst / musicLater).toBeLessThan(0.5);
  await press(lever("Music")); // leave it off for the next run
});

// Screams start straight away, then a new one every 1-2 s, overlapping the ones still going, and
// never the same person twice at once (Sean, 2026-11-07). Timed on the clips the page actually plays.
test("Screams start at once, come every 1-2 seconds and overlap", async ({ page }, info) => {
  test.skip(info.project.name !== "chrome-laptop", "one engine is enough to time the sound");
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    const starts: { at: number; length: number }[] = [];
    (window as unknown as { __starts: typeof starts }).__starts = starts;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...args: number[]) {
      if (this.buffer && !this.loop && this.buffer.duration < 20) starts.push({ at: performance.now() / 1000, length: this.buffer.duration });
      return start.apply(this, args as []);
    } as typeof start;
  });
  await login(page);
  const lever = page.getByRole("switch", { name: "Screams", exact: true });
  const switchedAt = await page.evaluate(() => performance.now() / 1000);
  await press(lever);
  const starts = () => page.evaluate(() => (window as unknown as { __starts: { at: number; length: number }[] }).__starts);
  await expect.poll(async () => (await starts()).length, { timeout: 30_000 }).toBeGreaterThanOrEqual(6);
  const s = await starts();
  expect(s[0].at - switchedAt).toBeLessThan(1);
  let overlaps = 0;
  for (let i = 1; i < s.length; i++) {
    const apart = s[i].at - s[i - 1].at;
    expect(apart).toBeGreaterThan(0.9);
    expect(apart).toBeLessThan(2.6); // 1-2 s, plus a moment to load a clip heard for the first time
    if (s[i].at < s[i - 1].at + s[i - 1].length) overlaps++;
  }
  expect(overlaps).toBeGreaterThan(0);
  await press(lever); // leave it off for the next run
});

// Screams are for the intense moments: switched on over the Intense music, they come out louder
// than the music, so they are heard clearly (Sean, 2026-11-07). Measured at the speakers.
test("Screams are heard clearly over the Intense music", async ({ page }, info) => {
  test.skip(info.project.name !== "chrome-laptop", "one engine is enough to measure the sound");
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    const meters = new Map<BaseAudioContext, AnalyserNode>();
    const connect = AudioNode.prototype.connect as (this: AudioNode, ...args: unknown[]) => unknown;
    AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
      if (args[0] instanceof AudioDestinationNode) {
        let m = meters.get(this.context);
        if (!m) meters.set(this.context, (m = this.context.createAnalyser()));
        connect.call(this, m);
      }
      return connect.apply(this, args);
    } as typeof AudioNode.prototype.connect;
    (window as unknown as { __rms: () => number }).__rms = () => {
      const [m] = meters.values();
      if (!m) return 0;
      const data = new Float32Array(m.fftSize);
      m.getFloatTimeDomainData(data);
      return Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
    };
  });
  // The typical loudness over a stretch: the median of many short readings, silences left out.
  const loudness = async (ms: number) => {
    const seen: number[] = [];
    for (const end = Date.now() + ms; Date.now() < end; ) {
      const v = await page.evaluate(() => (window as unknown as { __rms: () => number }).__rms());
      if (v > 0.003) seen.push(v);
    }
    seen.sort((a, b) => a - b);
    return seen[Math.floor(seen.length / 2)];
  };
  const lever = (name: string) => page.getByRole("switch", { name, exact: true });
  await login(page);

  await press(lever("Intense music"));
  await page.waitForTimeout(1000);
  const music = await loudness(4000);
  await press(lever("Intense music"));
  await page.waitForTimeout(1800);

  await press(lever("Screams"));
  const screams = await loudness(8000);
  await press(lever("Screams"));
  expect(screams / music).toBeGreaterThan(1.2); // at least about 1.5 dB louder than the music
  expect(screams / music).toBeLessThan(3); // but not blasting far over it
});
