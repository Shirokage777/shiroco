// Puts the card deck at data/cards.json before dev and build.
// Sources, in order: CARDS_LOCAL_PATH (a file on this computer),
// CARDS_REPO + CARDS_REPO_TOKEN (a private GitHub repo), or the example deck.
// On Vercel the private repo is required, so a deploy never ships example cards by mistake.
import { copyFile, readFile, writeFile } from "node:fs/promises";

const OUT = "data/cards.json";
const EXAMPLE = "data/example-cards.json";
const { CARDS_LOCAL_PATH, CARDS_REPO, CARDS_REPO_TOKEN, CARDS_REPO_PATH = "cards/base.json", VERCEL } = process.env;

function check(json, source) {
  const deck = JSON.parse(json);
  if (!Array.isArray(deck.cards) || deck.cards.length === 0) {
    throw new Error(`${source} has no cards`);
  }
  return deck;
}

async function fromRepo() {
  const url = `https://api.github.com/repos/${CARDS_REPO}/contents/${CARDS_REPO_PATH}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${CARDS_REPO_TOKEN}`, Accept: "application/vnd.github.raw+json" },
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${CARDS_REPO}/${CARDS_REPO_PATH}`);
  return res.text();
}

if (CARDS_LOCAL_PATH) {
  const deck = check(await readFile(CARDS_LOCAL_PATH, "utf8"), CARDS_LOCAL_PATH);
  await writeFile(OUT, JSON.stringify(deck));
  console.log(`cards: ${deck.cards.length} from local file`);
} else if (CARDS_REPO && CARDS_REPO_TOKEN) {
  const deck = check(await fromRepo(), CARDS_REPO);
  await writeFile(OUT, JSON.stringify(deck));
  console.log(`cards: ${deck.cards.length} from private repo`);
} else if (VERCEL) {
  console.error("CARDS_REPO and CARDS_REPO_TOKEN must be set on Vercel.");
  process.exit(1);
} else {
  await copyFile(EXAMPLE, OUT);
  console.log("cards: example deck (set CARDS_LOCAL_PATH or CARDS_REPO + CARDS_REPO_TOKEN for real cards)");
}
