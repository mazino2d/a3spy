---
name: software-engineer
description: Implement A3 Spy features and fixes on Cloudflare Workers + Durable Objects + grammY in TypeScript — from a story's acceptance criteria to a green PR. Use when the user asks to "implement", "code story L1/G2…", "fix bug", "refactor", "thêm lệnh bot", "sửa CI", "deploy", or touches src/, wrangler config or .github/workflows.
---

# Software engineer — A3 Spy

Read `AGENTS.md` first; its hard rules apply to everything below.

## Before writing code

1. Open the story issue (`gh issue view <n> --repo mazino2d/a3spy`) and `docs/rules.md`. If an acceptance criterion is ambiguous, pick the reading that best fits the PRD principles, note it in the PR, and move on; ask only when two readings change user-visible behaviour.
2. Branch from `main`: `feat/<story-id>-<slug>` or `fix/<slug>`.
3. List which layers the story touches: `game` (rules), `room`/`player` (state), `bot` (Telegram I/O).

## Build inside-out

1. **`src/game` first, test-first.** Model the change as pure data + functions: `(state, command, rng) → { state, events }`. Events (`PlayerEliminated`, `VoteOpened`, …) describe what happened; the bot layer turns them into messages. Write unit tests in `test/unit` before or with the code.
2. **Durable Object next.** `RoomDO` loads state, applies the game function, persists, then broadcasts events. Persist before sending messages so a crash cannot double-apply.
3. **Bot layer last.** Parse the update, route to the right DO, render events with strings from `src/bot/messages.ts`.

## Cloudflare Workers + Durable Objects

- Get a room stub with `env.ROOM.getByName(code)` (or `idFromName`); a player stub with `env.PLAYER.getByName(String(userId))`.
- A DO processes one request at a time per instance, so votes are serialized; do not add locks. Avoid `await`ing unrelated network calls between reading and writing state.
- Store state with the SQLite-backed storage API (`ctx.storage.sql` or `ctx.storage.kv`). Keep one versioned JSON document per room if that is simpler; add a `schemaVersion` and migrate on load.
- Timers and idle cleanup use `ctx.storage.setAlarm()`; one alarm per DO, so store the reason and next deadline in state.
- New DO classes need a `migrations` entry in `wrangler.jsonc` (`new_sqlite_classes`). Never rename or delete a class without a migration.
- No module-level mutable state. Env and bindings come from `env`; secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`.
- Free plan limits worth remembering: 100k requests/day, 10 ms CPU per request; keep handlers lean and avoid heavy libraries.

## Telegram (grammY)

- The Worker answers the webhook fast: reply with `200` after the handler finishes; grammY's `webhookCallback(bot, "cloudflare-mod", { secretToken })` checks the secret header.
- Always `answerCallbackQuery`, even for rejected taps; use `show_alert: true` for private info (e.g. "Xem từ của tôi").
- `callback_data` ≤ 64 bytes. Format: `<action>:<roomCode>:<round>[:<arg>]`. Reject when `round` ≠ current round (stale button).
- Deep link payload (`/start <code>`) is `[A-Za-z0-9_-]`, ≤ 64 chars.
- Broadcasting to a room = one `sendMessage` per player; stay under ~30 messages/second overall and 1/second per chat for bursts. A 12-player room is fine; batch per event, not per line.
- Prefer editing the lobby/status message (`editMessageText`) over sending new ones to keep chats tidy; store message ids per player in room state.
- A player who never pressed Start cannot be DMed (`403`). Treat that as "not joined" and tell the inviter.
- Display name: `first_name` + `last_name` when present, never the literal `"None"`/`"undefined"`.

## Secrecy checklist

- Words/roles only in the owner's DM or a `show_alert` popup.
- Not in logs (`console.log` of state must redact `word`/`role`), not in `callback_data`, not in error messages.

## Before opening the PR

- `npm run check` is green; `npx wrangler deploy --dry-run` succeeds if config changed.
- Each acceptance criterion maps to a test (name tests `"<story-id> <criterion>"`), or the PR says why it is manual.
- New user-facing text only in `src/bot/messages.ts`.
- `docs/rules.md` updated if behaviour changed (coordinate with the product-owner skill).
- PR title in Conventional Commits; body: summary, `Closes #<n>`, AC checklist, manual test notes, screenshots of the Telegram flow when UI changed.

## CI/CD

- `.github/workflows/ci.yml` runs on PRs; jobs are path-filtered and aggregated by **`ci-ok`**, the only required check. When adding a job, add it to `ci-ok`'s `needs` and to the path filters.
- `.github/workflows/cd.yml` runs on push to `main`: `wrangler deploy`, pushes Worker secrets, then calls `setWebhook` with the secret token. It is serialized with a `concurrency` group.
- Repo settings, branch protection and secrets are Terraform-managed in `mazino2d/everything-as-code`; do not change them in the GitHub UI.

## Local development

- `npm run dev` runs the Worker locally. To receive real Telegram updates, expose it (`cloudflared tunnel --url http://localhost:8787`) and point a **separate test bot**'s webhook at it; never point the production bot at your laptop.
- Put local secrets in `.dev.vars` (git-ignored).
