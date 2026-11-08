<!-- The original owner refreshes this file with scripts/export-agent.mjs. In your own copy, edit it freely. -->

# Crossroads Companion — privacy requirements

The owner's Dead of Winter Crossroads Companion web app holds the official Crossroads card texts (Plaid Hat Games' copyright). It is for the owner and close friends only, never public. Decided 2026-10-28.

## Must hold in every build step

- **Login first, nothing before it.** Hosted on the owner's own domain. Without a valid login nobody sees anything: no app, no card data, no hint of what the site is. The login page itself names nothing (no game name, no title, no description).
- **Neutral name and address.** The site runs as **shiroco** (`shiroco.vercel.app`, Vercel project `shiroco`), the owner's nickname plus "co", reusable for other things. No address, page title or project name visible to visitors says "crossroads", "dead of winter" or anything else that hints at the game; "Crossroads Companion" was the name of the official app. The owner's decision 2026-10-29.
- **Card data only behind the login.** Served by an authenticated endpoint, never as a public static file (no `cards.json` reachable by URL).
- **Search engines out, added automatically.** `<meta name="robots" content="noindex, nofollow">` on every page, an `X-Robots-Tag: noindex, nofollow` header on every response, and a `robots.txt` that disallows everything.
- **GitHub: public code, private data.** The code repo may be public so anyone can clone it and run it from the README (challenge rule "Anyone can copy it", see `plan.md`). Card texts, the card database, card photos, game graphics and any other copyrighted content never go into the public code repo, a gist or any other public place; `.gitignore` keeps them out, and the README explains how to add your own. Decided 2026-10-29.
- **Printed symbols are exact crops, kept private.** The game's symbols (weapon, mature, not-in-co-op, …) are cut from close-up photos of the owner's own cards and stored as images in `crossroads-data`, served by the app only after login, never in the public repo. Hand-drawn look-alikes are not used: the symbols must match the physical cards exactly. The owner's decision 2026-10-30.
- **Card photos are not kept.** They only serve the transcription, sit in the local, git-ignored `photos/` folder, and never go into any repo (the owner, 2026-10-29).
- **Copyrighted material lives in one private GitHub repo.** Card texts, the card database and any copyrighted images go into the owner's private repo `crossroads-data`, and nowhere else on GitHub. The Vercel build fetches the card data from it with a read-only token limited to that repo (secret in `~/.config/github/` and in Vercel, never in code). The repo stays private; collaborators only on the owner's go. The owner's decision 2026-10-29, chosen over Supabase and Vercel Blob as the simplest option.
- **Small circle.** Accounts only for the owner and close friends. If it ever goes public, the official card texts come out first.
