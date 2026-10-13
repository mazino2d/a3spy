# M1 Telegram game master — implementation plan

Status: shipped 2026-10-13   ·   Spec: [M1 Telegram game master](../product/specs/M1-telegram-game-master.md)   ·   Written 2026-10-13 (after the fact, from #1, #20 and #22)

How M1 was built: the architecture, the phases (one PR each) and the decisions behind
them. The spec defines *what* is true; this plan records *how*, so later milestones (M2,
M3) build on the same choices or change them on purpose.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Runtime | TypeScript on **Cloudflare Workers**, free plan, Telegram **webhook** | The legacy Python bot polled from a laptop and lost every room on restart. A Worker is online 24/7, costs nothing at < 30 users, and has no process to keep alive. |
| Telegram library | **grammY** with `webhookCallback(bot, "cloudflare-mod")` | First-class Workers support, typed Bot API, small bundle. |
| State | **Durable Objects**, SQLite-backed: `RoomDO` per room code, `PlayerDO` per Telegram user | A DO handles one request at a time, so simultaneous votes are serialized without locks; state survives deploys and isolate recycling. |
| Room storage | One JSON document per room (`ctx.storage.kv`, key `state`): the engine `Room`, the bot username and Telegram message IDs per slot | A room is small (≤ ~15 players); one read and one write per command is simpler than tables. |
| Game logic | A **pure state machine** in `src/game/engine.ts`: `(room, command) → { room, events } \| error`, randomness injected as `rng` | Rules are tested without Telegram or Cloudflare (seeded, deterministic), and any future client can reuse them. |
| Rendering | A **pure planner** `plan(before, after, events) → Op[]` in `src/bot/render.ts`; ops are `send`, `edit` (in place, by slot) and `pointer` (update a player's room) | Keeps Telegram I/O out of the rules and makes broadcasts testable as data. |
| Persist then send | `RoomDO.commit` stores the new room *before* executing ops | A failure mid-broadcast cannot replay the command; the worst case is a missed message, never a double vote. |
| Fan-out | Ops run in order per chat, chats in parallel | Keeps each player's messages ordered while a 12-player broadcast stays fast and under the 50-subrequest limit. |
| Edit in place | The lobby, vote panel and status message are edited rather than resent; message IDs are kept per slot and player | Keeps DMs tidy (principle 1); `editOrSend` falls back to sending if the old message is gone. |
| Player pointer | `PlayerDO` stores only the player's current room code; `RoomDO` owns the truth and checks membership on every use | A stale pointer can never lock a player out of joining another room. |
| Callback data | `<action>\|<room>\|<game>\|<round>\|<arg>`, short action codes, no words or roles | Stays well under Telegram's 64 bytes; game and round reject stale buttons; secrecy (AGENTS rule 4). |
| Secret word | Dealt by DM; seen again through a `show_alert` popup on the status message | Only the owner ever sees it; no new message to scroll past. |
| Idle rooms | One DO alarm, re-armed on every commit, closes a room after 6 h without activity | Free cleanup with no cron; one alarm per DO is enough. |
| Webhook auth | Constant-time check of `X-Telegram-Bot-Api-Secret-Token` before the bot is built | grammY would otherwise call `getMe` for forged requests. `getMe` is cached per isolate. |
| Webhook timeout | 50 s | A room broadcast is a few dozen Telegram calls; Telegram must not retry the update mid-broadcast. |
| Word packs | `words/*.json`, one theme per file, bundled and validated at load and in tests | Friends add pairs by PR; no runtime config that anyone can overwrite (the legacy `/config` problem). |
| Bot profile | Name, descriptions, command menu and avatar as code in `telegram/`, synced by a workflow | The profile changes by PR like everything else and stays in step with `/help`. |
| Delivery | GitHub Actions: CI on PRs (path-filtered, aggregated by `ci-ok`); CD on `main` runs `wrangler deploy` with secrets, a `/healthz` smoke test and `setWebhook` | Merging is deploying; one required check works for docs-only PRs too. |
| Secrets and repo settings | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` and the Cloudflare token live in GitHub secrets managed by Terraform in `mazino2d/everything-as-code` | The legacy token leaked in this public repo; it was revoked and nothing secret is configured here. |

## Architecture

```text
Telegram ──webhook──▶ Worker (src/index.ts)
                       │  secret header check, /healthz
                       ▼
                  grammY (src/bot/bot.ts)
                  /start /help /newgame /join /leave /end /score,
                  callback_query, text (Mr. White's guess)
                       │
           ┌───────────┴─────────────┐
           ▼                         ▼
   RoomDO "<code>"            PlayerDO "<telegram id>"
   load → engine command      current room code
   → persist → plan() → ops
   → Telegram (send / edit)
   idle alarm (6 h)
           │
           ▼
   src/game: engine (state machine), roles (deal, counts),
             words (packs), rng (seeded / crypto)
```

A command's life: Telegram update → grammY handler resolves the player's room through
`PlayerDO` → `RoomDO.onCallback` / `onText` / `join` … → `engine.*` returns the next room
and events → `commit` persists, re-arms the alarm, and executes `plan()`'s ops → the
handler answers the callback query.

## Phases

| Phase | Scope | Stories | PR | Status |
| --- | --- | --- | --- | --- |
| P1 | Rewrite for Workers: webhook Worker, grammY skeleton (`/start`, `/help`), seeded RNG, role counts and dealing, word packs, CI and CD, AGENTS and skills; remove the Python bot | — | #1 | Done |
| P2 | Full game over DM: engine state machine, render planner, `RoomDO`, `PlayerDO`, callbacks, every command; 77 tests | L1–L3, L5, R1, R2, G1–G4, E1–E4, S1 | #20 | Done |
| P3 | Docs in English, PRD in the repo | — | #21 | Done |
| P4 | Bot profile, command menu and avatar as code; `designer` skill | — | #22 | Done |

The stories in P2 shipped in one PR because they form a single game loop; AGENTS.md was
updated to allow tightly coupled stories to share a PR.

## Tests

| Level | Where | Covers |
| --- | --- | --- |
| Unit | `test/unit/engine.test.ts`, `roles.test.ts`, `words.test.ts`, `telegram-profile.test.ts` | Rules for every story: order over 200 seeds (Mr. White never first), ties and revotes, win check, guess matching, 24 h pair repeat, host hand-over; role table; pack validity; profile limits and `/help` coverage |
| Integration | `test/integration/webhook.test.ts`, `game.test.ts` | Webhook auth (401, no Telegram calls), full games through the Worker and DOs with Telegram stubbed; the spy's word reaches nobody else and no word appears in any `callback_data` |
| Manual | software-tester playtest checklist | Feel, wording and speed at a real table: still open until the first café session |

## Known limits

- Every player needs Telegram. M3 adds a web client for everyone else.
- A message Telegram refuses (e.g. the player blocked the bot) is logged without its text
  and skipped; the game goes on and that player misses the message.
- Settings are fixed to the defaults until M2 (L4).
- Every Telegram call and DO call in a command counts toward the free plan's 50
  subrequests per invocation; a broadcast is one batch per event, never a loop on top of a
  per-player loop.
