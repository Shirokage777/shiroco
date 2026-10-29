# Crossroads Companion

A private, browser-based companion for the board game *Dead of Winter*. The group plays the physical game; the app holds the Crossroads card deck, so nobody has to read cards aloud. It runs on phone, tablet and laptop.

**This repo contains no card texts or game graphics.** They are copyrighted by Plaid Hat Games. The app ships with three made-up example cards; to play with the real deck you add your own transcription of the cards you own (see below).

## Run it

Needs Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without your own cards the app uses `data/example-cards.json`.

## Add your own cards

Write your deck as JSON in the same shape as `data/example-cards.json`: `{ "set", "count", "cards": [ { "id", "set", "title", "trigger", "text", "options": [ { "label", "text" } ], "mature", "noCoop", "notes"? } ] }`.

Before every `dev`, `test` and `build`, `scripts/fetch-cards.mjs` copies the deck to `data/cards.json` (git-ignored, never committed). It takes the first source that is set:

1. **A file on your computer:** put `CARDS_LOCAL_PATH=/path/to/your/cards.json` in `.env.local`.
2. **A private GitHub repo:** set `CARDS_REPO` (`owner/name`), `CARDS_REPO_TOKEN` (a fine-grained token with read-only access to that one repo's contents) and optionally `CARDS_REPO_PATH` (default `cards/base.json`).
3. **Otherwise** the example deck.

On Vercel, option 2 is required: the build stops if it is not set, so a deploy never ships the example cards by mistake.

## Accounts

Nothing is shown before login. Each person gets a name and password; only a salted scrypt hash is stored.

```bash
npm run add-user -- <name>
```

It asks for the password twice (hidden) and writes the hash to `~/.config/crossroads-companion/users` (or `APP_USERS_FILE`). Sessions are signed with a random secret of at least 32 characters.

| Variable | Local (`.env.local`) | Vercel |
|---|---|---|
| Accounts | `APP_USERS_FILE=<path to users file>` | `APP_USERS` = the file's content |
| Session secret | `SESSION_SECRET_FILE=<path to secret file>` | `SESSION_SECRET` |

## Deploy on Vercel

1. Import this repo in Vercel.
2. Add the environment variables `CARDS_REPO`, `CARDS_REPO_TOKEN`, `SESSION_SECRET` and `APP_USERS` (Production and Preview).
3. Deploy. The build runs the tests first; a failing test stops the deploy.

## Privacy

- Without a valid session every page redirects to the login and every API answers 401; the login page names nothing about the game.
- Card data is bundled into server code only, served only by `/api/cards` to logged-in users, and never as a public file.
- Every page is `noindex, nofollow` (meta tag and `X-Robots-Tag` header), and `robots.txt` disallows everything.
- Page titles name nothing about the game.
- The tests check all of this, including that no real card text sits in any file git would commit.

## Tests

```bash
npm test
```
