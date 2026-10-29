// Puts the card deck at data/cards.json and the printed symbols in data/symbols/ before dev and build.
// Sources, in order: CARDS_LOCAL_PATH (a file on this computer; symbols from the "symbols" folder
// next to its folder), CARDS_REPO + CARDS_REPO_TOKEN (a private GitHub repo), or the example deck
// (no symbols: the app then shows symbol names as words).
// On Vercel the private repo is required, so a deploy never ships example cards by mistake.
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const OUT = "data/cards.json";
const SYMBOLS = "data/symbols";
const EXAMPLE = "data/example-cards.json";
const {
  CARDS_LOCAL_PATH,
  CARDS_REPO,
  CARDS_REPO_TOKEN,
  CARDS_REPO_PATH = "cards/base.json",
  CARDS_SYMBOLS_PATH = "symbols",
  VERCEL,
} = process.env;
const SYMBOL_FILE = /^[a-z0-9-]+\.png$/;

function check(json, source) {
  const deck = JSON.parse(json);
  if (!Array.isArray(deck.cards) || deck.cards.length === 0) {
    throw new Error(`${source} has no cards`);
  }
  return deck;
}

function github(path, accept) {
  return fetch(`https://api.github.com/repos/${CARDS_REPO}/contents/${path}`, {
    headers: { Authorization: `Bearer ${CARDS_REPO_TOKEN}`, Accept: accept },
  });
}

async function fromRepo() {
  const res = await github(CARDS_REPO_PATH, "application/vnd.github.raw+json");
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${CARDS_REPO}/${CARDS_REPO_PATH}`);
  return res.text();
}

async function symbolsFromRepo() {
  const res = await github(CARDS_SYMBOLS_PATH, "application/vnd.github+json");
  if (res.status === 404) return 0;
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${CARDS_REPO}/${CARDS_SYMBOLS_PATH}`);
  const files = (await res.json()).filter((f) => f.type === "file" && SYMBOL_FILE.test(f.name));
  for (const f of files) {
    const img = await github(f.path, "application/vnd.github.raw+json");
    if (!img.ok) throw new Error(`GitHub answered ${img.status} for ${f.path}`);
    await writeFile(join(SYMBOLS, f.name), Buffer.from(await img.arrayBuffer()));
  }
  return files.length;
}

async function symbolsFromFolder(folder) {
  const names = (await readdir(folder).catch(() => [])).filter((n) => SYMBOL_FILE.test(n));
  for (const n of names) await copyFile(join(folder, n), join(SYMBOLS, n));
  return names.length;
}

await rm(SYMBOLS, { recursive: true, force: true });
await mkdir(SYMBOLS, { recursive: true });

if (CARDS_LOCAL_PATH) {
  const deck = check(await readFile(CARDS_LOCAL_PATH, "utf8"), CARDS_LOCAL_PATH);
  await writeFile(OUT, JSON.stringify(deck));
  const symbols = await symbolsFromFolder(join(dirname(CARDS_LOCAL_PATH), "..", CARDS_SYMBOLS_PATH));
  console.log(`cards: ${deck.cards.length} from local file, ${symbols} symbols`);
} else if (CARDS_REPO && CARDS_REPO_TOKEN) {
  const deck = check(await fromRepo(), CARDS_REPO);
  await writeFile(OUT, JSON.stringify(deck));
  const symbols = await symbolsFromRepo();
  console.log(`cards: ${deck.cards.length} from private repo, ${symbols} symbols`);
} else if (VERCEL) {
  console.error("CARDS_REPO and CARDS_REPO_TOKEN must be set on Vercel.");
  process.exit(1);
} else {
  await copyFile(EXAMPLE, OUT);
  console.log("cards: example deck (set CARDS_LOCAL_PATH or CARDS_REPO + CARDS_REPO_TOKEN for real cards)");
}
