# M7 Web only — implementation plan

Status: shipped 2026-10-18   ·   Spec: [M7 Web only](../product/specs/M7-web-only.md)   ·   Written 2026-10-17

How the game leaves Telegram: an announcement channel first, then one cutover deploy that
removes the Telegram game and deletes the old data. The spec defines *what*; this plan
records *how*.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Order | **P1 announcements, then a manual "we're moving" announcement, then P2 cutover.** | The list of people to tell must exist before the cutover deletes the data it comes from, and the group should hear about the move before the bot stops running games. |
| Announcement list | New `AudienceDO` ("bot"), one key per Telegram user id: `u:<id>`. Every update the webhook receives adds its sender. P1 seeds it once from the Telegram ids (positive ids) in `StatsDO`. | Durable Objects cannot be listed, so `PlayerDO` cannot be swept for ids; `StatsDO` holds everyone who finished a game. The list holds ids only, no game data, and is the one thing the cutover keeps (AC12). |
| Owner | `OWNER_TELEGRAM_ID` Worker secret; `/announce` from anyone else gets the signpost (AC5). | Not in code or git (AGENTS rule 3); set by hand on the `github` workspace like the bot token. |
| Sending | `AudienceDO.announce(id)` sends in batches of 20 `sendMessage` calls, one batch per alarm, recording progress in storage, then messages the owner the summary. Text is sent without `parse_mode` (plain text). | The free plan allows 50 subrequests per invocation and Telegram ~30 messages/s; batching keeps both safe as the list grows. Plain text means `<` or `&` in an announcement cannot break it. |
| Preview | `/announce <text>` stores `{ id, text }` as the one pending announcement and replies with the exact text, the recipient count, and **Gửi** / **Huỷ** callback buttons `an|<id>|send` / `an|<id>|cancel`. A newer `/announce` replaces it, so an older preview's **Gửi** is stale (AC6). | A broadcast cannot be taken back; the preview is the safety. |
| Deleting old data | `wrangler.jsonc` migration `v4` with `deleted_classes: ["RoomDO", "PlayerDO", "StatsDO"]` and `v5` with `new_sqlite_classes` for their replacements `GameRoomDO`, `GuestDO`, `LeaderboardDO`, in **one deploy**, with the bindings renamed at the same time: `ROOM`→`GAME_ROOM`, `PLAYER`→`GUEST`, `STATS`→`LEADERBOARD`. | `deleted_classes` is the only way to delete every instance of a class (instances cannot be listed). Rehearsed on a temporary Cloudflare account (2026-10-17): deleting a class while a binding of the same name moves to the new class is refused (code 10061), and creating the new classes first is refused while the old ones are still stored but no longer exported (code 10064). Renaming the bindings in the same deploy is accepted. |
| Bot after cutover | `src/bot/bot.ts` keeps three handlers: `/start <code>` (room button, AC8), `/announce` (owner), and everything else → signpost (AC7). Callback queries: `an|…` for announcements, anything else → "A3 Spy đã chuyển sang web" (AC9). | The bot no longer knows any game, so it can never leak a word (AC14). |
| What is removed | `src/bot/render.ts`, `src/bot/callbacks.ts` and the game strings in `src/bot/messages.ts`; the RoomDO's Telegram side (`execute`, `Op`s, `ui` message ids, `onCallback`, `onText`, `end`, `score`); `isTelegram` paths; voice for Telegram players (`src/web/voiceAuth.ts`, `/api/voice/*`, `/v/<code>`, `login_url`); `links.telegram` in the socket protocol and the lobby. | Half of the code that every feature had to touch. The engine (`src/game`) does not change: it never knew about clients. |
| Room pointer | `PlayerDO`'s replacement keeps `room` for web guests only. | The web app still needs "which room am I in" for one-room-per-player and the installed app's start screen. |

## Architecture after M7

```text
Telegram ──webhook──▶ Worker ──▶ bot: signpost · /start <code> → web room button · /announce
                        │                          │
                        │                          ▼
                        │                    AudienceDO "bot" (Telegram ids, pending announcement, send progress)
Browser ──/api, ws────▶ │──▶ GameRoomDO (per room) ──▶ src/game (rules), voice roster
        ◀─web/dist──────┘      GuestDO (per web guest) · LeaderboardDO "group"
```

## Phases

| Phase | Scope | Stories · ACs | Effort | PR | Status |
| --- | --- | --- | --- | --- | --- |
| P1 | `AudienceDO` (migration `v3`), record every update's sender, seed from `StatsDO`, `/announce` with preview, confirm, batched send and summary; `OWNER_TELEGRAM_ID` secret in CD | B1 · AC1–AC6 | 1 | #71 | Done |
| — | **Owner sends the "A3 Spy moves to the web" announcement** with the web link and the cutover date | — | — | | Owner step |
| P2 | Cutover: bot becomes a signpost; remove the Telegram game and Telegram voice; protocol and lobby drop Telegram links; migrations `v4`/`v5` delete and replace the old classes; bot profile; `docs/rules.md`, README, AGENTS updated | X1–X4, B2 · AC7–AC14 | 2 | #72 | Done |

Total 3 days, as estimated on the roadmap.

## Tests

| Level | Where | Covers |
| --- | --- | --- |
| Unit | `test/unit/announce.test.ts` | Batching (25 recipients → 2 batches), stale preview ids, plain-text length check |
| Integration | `test/integration/announce.test.ts` | Any update adds its sender once; seeding from stats; owner-only `/announce`; preview text and count; **Gửi** sends to all and reports, a 403 user is removed; stale **Gửi** sends nothing |
| Integration | `test/integration/webhook.test.ts` (rewritten) | Signpost for `/start`, `/help`, old commands and text; `/start <code>` room button; old game buttons answered with "moved to the web"; no bot message carries a word |
| Integration | `test/integration/game.test.ts` (removed) | Telegram gameplay. Its rules coverage already exists in `test/unit` and `test/integration/web.test.ts`; any gap found while deleting is ported to the web tests in the same PR. |
| Manual | P2 PR checklist | `wrangler deploy --dry-run` with the migrations; after deploy: an old room link says "not found", the leaderboard is empty, an old invite link opens the room button |

## Risks

| Risk | Mitigation |
| --- | --- |
| `deleted_classes` behaves differently than expected (e.g. refuses while bindings exist) | Rehearsed on a temporary account: main, then this branch on top. It refused the first two layouts and accepted the renamed bindings (see Decisions). |
| Players miss the announcement and look for games in Telegram | Every message and tap in the bot answers with the web button (AC7, AC9), and old invite links still reach the room (AC8). |
| Deleting the data is irreversible | It is the decision (2026-10-17). P2's description repeats it, and the merge is the owner's call. |
| An announcement goes to the wrong people or twice | Preview and confirm; one pending announcement; progress stored before each batch so a retried alarm never resends a batch. |

## Infra (`everything-as-code`)

- Add the sensitive variable `a3spy_owner_telegram_id` to the `github` workspace and an
  Actions secret `OWNER_TELEGRAM_ID` on a3spy (same pattern as `TELEGRAM_BOT_TOKEN`); `cd.yml`
  pushes it to the Worker.
- After P2, the bot's Login Widget domain (BotFather `/setdomain`) is unused; clear it with
  `/empty`.
