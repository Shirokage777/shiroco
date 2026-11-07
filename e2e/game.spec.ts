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

test("the sound levers switch, stay switched, and narration loads", async ({ page }) => {
  const errors = watchErrors(page);
  await login(page);
  const levers = page.getByRole("switch");
  await expect(levers).toHaveCount(5);
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

  for (const name of ["Narrate", "Ambience", "Music", "Zombies"]) {
    await expect(lever(name)).toHaveAttribute("aria-checked", "false");
    await press(lever(name));
    await expect(lever(name)).toHaveAttribute("aria-checked", "true");
  }
  await page.reload();
  for (const name of ["Narrate", "Ambience", "Music", "Zombies"]) {
    await expect(lever(name)).toHaveAttribute("aria-checked", "true");
  }
  await expect(lever("Intense music")).toHaveAttribute("aria-checked", "false");

  await press(page.getByRole("button", { name: /Start game/ }));
  await press(page.getByRole("button", { name: "Draw card", exact: true }));
  // The Windows build of Safari's engine has no Web Audio (real Safari does), so the app plays
  // nothing there; only browsers that can play check that the narration loads.
  if (await page.evaluate(() => "AudioContext" in window)) {
    const narration = page.waitForResponse((r) => /\/api\/narration\/[^/]+\/text$/.test(r.url()));
    await press(page.getByRole("button", { name: "Triggered", exact: true }));
    expect((await narration).status()).toBe(200);
  } else {
    await press(page.getByRole("button", { name: "Triggered", exact: true }));
  }

  // Switch everything off again: the next visitor of this browser starts in silence.
  for (const name of ["Narrate", "Ambience", "Music", "Zombies"]) await press(lever(name));
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
