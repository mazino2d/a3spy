# M5 Long-term stats — implementation plan

Status: shipped 2026-10-14   ·   Spec: [M5 Long-term stats](../product/specs/M5-long-term-stats.md)   ·   Written 2026-10-14 (after the fact, from #44)

How M5 was built: the decisions, the moving parts and the tests. The spec defines *what*
is true; this plan records *how*.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Storage | A new Durable Object class `StatsDO`, one instance named `"group"`, one KV key `p:<player id>` per player; migration `v2` in `wrangler.jsonc` | Fewer than 30 players: one object holds everyone, the leaderboard is a single `list()`, and writes are serialized for free. A per-player store would need a fan-out read for the leaderboard. |
| What is stored | `PlayerStats { id, name, games, wins, spy { games, wins }, white { games, wins, correct } }` | Exactly the numbers the spec shows; names for the leaderboard; never words. |
| Pure logic | `src/game/stats.ts`: `gameResults(game)`, `addResult(stats, result)`, `winRate`, `leaderboard(all, 10)` | Counting rules are unit-tested without storage; the DO only reads and writes. |
| What counts | `gameResults` returns nothing unless the game ended with a winner; winners come from `engine.winners()`; a Mr. White win is a correct guess | Same rule as the room score (`/end` counts for nobody); one source for who won. |
| When it is written | In `RoomDO.commit`, after the room is persisted and web players are updated, when the events include `game_ended` | The game result is final before stats see it; Telegram fan-out is not delayed by more than one DO call. |
| Failure | `recordStats` catches and logs (room code and error only) | Stats are a bonus; a failed write must never break or replay a game. |
| Identity | Player ID as is: Telegram users positive, web guests negative; no linking | The decision of 2026-10-14. Two records for a friend on both clients is accepted. |
| Ranking | Wins, then win rate, then fewer games; top 10; players with no games skipped | Rewards playing and winning; the tie-breaks keep the order stable. |
| Telegram | `/stats` in `src/bot/bot.ts`, text from `statsMessage()` in `src/bot/render.ts`; added to `/help` and `telegram/profile.json` | The profile test requires every advertised command in `/help`; the profile workflow syncs the menu on merge. |
| Web | `GET /api/stats` (session required, `no-store`) and a `/stats` route with its own screen, reached from home and the room scoreboard | Stats are outside any room, so they are a page, not part of the room socket. |

## Architecture

```text
RoomDO.commit (game_ended with a winner)
   └─ gameResults(game) ──▶ StatsDO "group".record(results)      src/game/stats.ts → src/stats/StatsDO.ts
                                 p:<id> = addResult(p:<id> ?? empty, result)

Telegram /stats ──▶ StatsDO.read(userId) ──▶ statsMessage(me, board)
Web /stats ──▶ GET /api/stats ──▶ StatsDO.read(guestId) ──▶ { me, board }
```

## Phases

| Phase | Scope | ACs | PR | Status |
| --- | --- | --- | --- | --- |
| P1 | Spec, pure stats, `StatsDO` and migration, recording from RoomDO, Telegram `/stats`, web API and screen, strategy change (stats leave the non-goals), rules | AC1–AC7 | #44 | Done |

## Tests

| Level | Where | Covers |
| --- | --- | --- |
| Unit | `test/unit/stats.test.ts` | Games, wins and role counts for a civilian win; Mr. White correct guess; `/end` counts for nobody; leaderboard order and top 10; no words in results |
| Integration | `test/integration/game.test.ts` › long-term stats over Telegram | "No games yet"; a full Telegram game then `/stats` for a civilian and the spy, leaderboard line, no dealt word in either message; `/end` leaves stats unchanged |
| Integration | `test/integration/web.test.ts` › long-term stats on the web | `/api/stats` for a new guest (`me: null`, board array) and 401 without a session |
| Browser | Headless Chrome run recorded in #44 | A won game and an early-ended game, then the Stats screen shows only the won game |

## Known limits

- Stats start on 2026-10-14; earlier games are not counted.
- The test suite shares Durable Object storage across tests, so integration tests use
  unique player IDs and never assert on the whole leaderboard.
- One group for everyone: two separate friend groups using the same bot would share a
  leaderboard (out of scope for a single friend group).
