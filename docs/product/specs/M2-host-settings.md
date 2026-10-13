# M2 Host settings and playtest fixes

Status: shipped 2026-10-13   ·   Serves: UC-7   ·   Roadmap: Shipped

## Problem

Every game uses the default role table and all word themes. A table that wants an easier
game (no Mr. White), a harder one (two spies at 6 players) or only food words has no way to
ask for it. The first café sessions will also surface small frictions that are worth fixing
before the group gets used to them.

## User stories

- **L4** ([#5](https://github.com/mazino2d/a3spy/issues/5)) As a host, I set the word themes, the number of spies and Mr. White on or off
  before starting, so the game fits the table.
- Playtest fixes: one story or bug issue per finding, added to this milestone as they come.

## Acceptance criteria

- **AC1** Given a lobby, when it opens, then settings show the defaults: all themes, spies
  and Mr. White from the [role table](../../rules.md#default-role-counts) for the current
  player count.
- **AC2** Given the host's lobby, when the host changes a setting, then every player's
  lobby (Telegram and web) shows the new value; settings controls appear only for the host.
- **AC3** Given settings where civilians ≤ spies + Mr. White, when the host taps Start, then
  the game does not start and the host sees why in one line.
- **AC4** Given a finished game, when the host taps Play again, then the same settings apply.
- **AC5** Given the player count changes in the lobby, when the host has not touched the
  role counts, then they follow the role table; once the host changes them, they stay.

## Edge cases checklist

- Host leaves while editing settings: the new host keeps the current settings.
- A theme with fewer pairs than recently played: fall back to the pairs least recently played.
- Settings change while a game is running: not possible; settings show only in the lobby.

## Out of scope

- Timers (Later).
- Custom word lists typed in chat (rejected; packs come by PR).

## Open questions

- Should Mr. White default on at 5–6 players, or only from 7? Decide after the first
  playtest using the balance bar (spy side wins 35–55 %).
