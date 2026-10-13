# M5 Long-term stats

Status: in progress   ·   Serves: UC-6   ·   Roadmap: Now

## Problem

The room scoreboard resets with every room, so nobody can show off a season of wins or
prove they are the best spy in the group. Friends want numbers that last across rooms and
café sessions.

## Decisions (2026-10-14)

| Topic | Decision |
| --- | --- |
| Scope | Personal stats and one leaderboard for the whole group. |
| What counts | Games finished with a winner (a game ended early with `/end` counts for nothing, like the room score). |
| Numbers | Games played, games won, win rate; as spy: games and wins; as Mr. White: games, wins and correct guesses. |
| Identity | **No linking.** A Telegram player and a web guest are separate records even if they are the same friend; a web guest who clears the browser starts a new record. |
| Where | Telegram: `/stats`. Web: a Stats screen reached from the home screen and from the room scoreboard. |
| Secrecy | Stats store names, roles and results, never words. |
| Storage | One Durable Object for the group (< 30 players), written once per finished game. |

## User stories

| ID | Story | Priority |
| --- | --- | --- |
| S2 ([#19](https://github.com/mazino2d/a3spy/issues/19)) | As a player, I see my long-term stats and the group leaderboard so I can show off. | Could |

## Acceptance criteria

- **AC1** Given a game that ends with a winner, then every player dealt into it gets +1 game, and +1 win if their side won (alive or not); spies and Mr. White also get +1 game in their role, +1 win in it if their side won.
- **AC2** Given Mr. White guesses the civilians' word correctly, then their correct guesses go up by one.
- **AC3** Given a game ended early by the host, then nobody's stats change.
- **AC4** Given a Telegram player sends `/stats`, then they see their own numbers and the group leaderboard (top 10 by wins, then win rate).
- **AC5** Given a web player opens Stats, then they see the same: their own numbers and the leaderboard.
- **AC6** Given a player with no finished game yet, then they see a one-line "no games yet" instead of zeros.
- **AC7** Given any stats screen or message, then no word from any game appears.

## Edge cases checklist

- Same friend on Telegram and the web: two lines on the leaderboard (decided, no linking).
- Name changes: the leaderboard shows the latest name.
- Stats write fails: the game still ends normally; only the stats miss that game.

## Out of scope

- Linking web guests to Telegram players (rejected 2026-10-14).
- Per-room or per-season boards, resetting stats.

## Success check

Friends quote `/stats` at the table.
