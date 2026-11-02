// Puts the card deck at data/cards.json, the printed symbols in data/symbols/, the card narration
// in data/audio/<card id>/<clip>.mp3 and the private music in data/music/ before dev and build.
// Sources, in order: CARDS_LOCAL_PATH (a file on this computer; symbols, narration and music from
// the "symbols", "audio" and "music" folders next to its folder), CARDS_REPO + CARDS_REPO_TOKEN (a
// private GitHub repo), or the example deck (no symbols, narration or music: the app then shows
// symbol names as words and stays silent).
// On Vercel the private repo is required, so a deploy never ships example cards by mistake.
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const OUT = "data/cards.json";
const SYMBOLS = "data/symbols";
const AUDIO = "data/audio";
const MUSIC = "data/music";
const EXAMPLE = "data/example-cards.json";
const {
  CARDS_LOCAL_PATH,
  CARDS_REPO,
  CARDS_REPO_TOKEN,
  CARDS_REPO_PATH = "cards/base.json",
  CARDS_SYMBOLS_PATH = "symbols",
  CARDS_AUDIO_PATH = "audio",
  CARDS_MUSIC_PATH = "music",
  VERCEL,
} = process.env;
const SYMBOL_FILE = /^[a-z0-9-]+\.png$/;
const MUSIC_FILE = /^[a-z0-9-]+\.mp3$/;
const CARD_DIR = /^[a-z0-9-]+$/;
const CLIP_FILE = /^(text|option-\d)\.mp3$/;

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

// The files of one folder of the repo (symbols, music) whose names match.
async function folderFromRepo(path, name, out) {
  const res = await github(path, "application/vnd.github+json");
  if (res.status === 404) return 0;
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${CARDS_REPO}/${path}`);
  const files = (await res.json()).filter((f) => f.type === "file" && name.test(f.name));
  for (const f of files) {
    const file = await github(f.path, "application/vnd.github.raw+json");
    if (!file.ok) throw new Error(`GitHub answered ${file.status} for ${f.path}`);
    await writeFile(join(out, f.name), Buffer.from(await file.arrayBuffer()));
  }
  return files.length;
}

// Narration clips: one listing of the repo tree, then the files a few at a time.
async function audioFromRepo() {
  const res = await fetch(`https://api.github.com/repos/${CARDS_REPO}/git/trees/HEAD?recursive=1`, {
    headers: { Authorization: `Bearer ${CARDS_REPO_TOKEN}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for the tree of ${CARDS_REPO}`);
  const prefix = `${CARDS_AUDIO_PATH}/`;
  const clips = (await res.json()).tree.filter((f) => {
    if (f.type !== "blob" || !f.path.startsWith(prefix)) return false;
    const [card, clip, ...rest] = f.path.slice(prefix.length).split("/");
    return rest.length === 0 && CARD_DIR.test(card) && CLIP_FILE.test(clip ?? "");
  });
  for (let i = 0; i < clips.length; i += 8) {
    await Promise.all(
      clips.slice(i, i + 8).map(async (f) => {
        const file = await github(f.path, "application/vnd.github.raw+json");
        if (!file.ok) throw new Error(`GitHub answered ${file.status} for ${f.path}`);
        const out = join(AUDIO, f.path.slice(prefix.length));
        await mkdir(dirname(out), { recursive: true });
        await writeFile(out, Buffer.from(await file.arrayBuffer()));
      }),
    );
  }
  return clips.length;
}

async function audioFromFolder(folder) {
  let count = 0;
  for (const card of (await readdir(folder).catch(() => [])).filter((n) => CARD_DIR.test(n))) {
    const clips = (await readdir(join(folder, card)).catch(() => [])).filter((n) => CLIP_FILE.test(n));
    await mkdir(join(AUDIO, card), { recursive: true });
    for (const c of clips) await copyFile(join(folder, card, c), join(AUDIO, card, c));
    count += clips.length;
  }
  return count;
}

async function folderFromDisk(folder, name, out) {
  const names = (await readdir(folder).catch(() => [])).filter((n) => name.test(n));
  for (const n of names) await copyFile(join(folder, n), join(out, n));
  return names.length;
}

for (const dir of [SYMBOLS, AUDIO, MUSIC]) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}

if (CARDS_LOCAL_PATH) {
  const deck = check(await readFile(CARDS_LOCAL_PATH, "utf8"), CARDS_LOCAL_PATH);
  await writeFile(OUT, JSON.stringify(deck));
  const root = join(dirname(CARDS_LOCAL_PATH), "..");
  const symbols = await folderFromDisk(join(root, CARDS_SYMBOLS_PATH), SYMBOL_FILE, SYMBOLS);
  const clips = await audioFromFolder(join(root, CARDS_AUDIO_PATH));
  const music = await folderFromDisk(join(root, CARDS_MUSIC_PATH), MUSIC_FILE, MUSIC);
  console.log(`cards: ${deck.cards.length} from local file, ${symbols} symbols, ${clips} narration clips, ${music} music`);
} else if (CARDS_REPO && CARDS_REPO_TOKEN) {
  const deck = check(await fromRepo(), CARDS_REPO);
  await writeFile(OUT, JSON.stringify(deck));
  const symbols = await folderFromRepo(CARDS_SYMBOLS_PATH, SYMBOL_FILE, SYMBOLS);
  const clips = await audioFromRepo();
  const music = await folderFromRepo(CARDS_MUSIC_PATH, MUSIC_FILE, MUSIC);
  console.log(`cards: ${deck.cards.length} from private repo, ${symbols} symbols, ${clips} narration clips, ${music} music`);
} else if (VERCEL) {
  console.error("CARDS_REPO and CARDS_REPO_TOKEN must be set on Vercel.");
  process.exit(1);
} else {
  await copyFile(EXAMPLE, OUT);
  console.log("cards: example deck (set CARDS_LOCAL_PATH or CARDS_REPO + CARDS_REPO_TOKEN for real cards)");
}
