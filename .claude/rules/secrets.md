# Secrets stay out of the repo and the chat

## Trigger
A task needs, stores, reads or checks a password, token or key (e.g. `SESSION_SECRET`, `CARDS_REPO_TOKEN`, account passwords).

## Action
- **Where:** locally in `.env.local` (git-ignored), on Vercel in the project's environment variables. Never in code, the README, a commit, an issue or a log.
- **Never** ask for a secret in chat and never print one: chat is saved to disk. When a new key is needed, say where to get it (exact URL), where to put it, and what a correct value looks like (prefix, rough length); the owner enters it.
- **Checking a key:** show only its first 4 characters and its length, then make one real call that proves it works.
- **Least access:** the card data token reads one private repo's contents and nothing else.
- **Accounts:** never invent, set or change a password on the owner's accounts; app accounts are created by the owner with `npm run add-user`.

## Done when
No secret value appears in the repo, in chat, or in a file you wrote.
