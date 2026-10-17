# Product strategy

> Source of truth for product decisions. The `product-owner` skill reads this file before
> triaging, writing specs or reordering the roadmap. Change it deliberately: every change
> here shifts what gets built.

Last reviewed: 2026-10-17 (M7: web only)

## Vision

Everyone at the table plays, nobody runs the game. A3 Spy is the game master for *Who is
Spy* (Undercover rules) when a group of friends plays together, around one café table or
from different places on the room's voice call: people describe and argue out loud, and
A3 Spy deals the secret words, calls the speaking order, runs the vote, eliminates,
reveals and keeps score.

## Problem

The legacy bot only dealt words. Someone still had to run the game by hand, and that
person never got to play properly.

- **It dealt roles but did not run the game.** No speaking turns, no vote, no elimination
  and no win check, so the table had to remember who was out.
- **The rules were too thin.** Always exactly one spy with no word, so with 5+ players the
  spy was found almost immediately.
- **It was clumsy.** A reply keyboard to pick a room and a typed command for every step.
- **Anyone could break a game.** `/reset` wiped every room; `/config` replaced everyone's
  word list.
- **It was unreliable.** It ran on a laptop with state in memory.

[M1](specs/M1-telegram-game-master.md) fixed all five on Telegram, and the web app
([M3](specs/M3-web-app.md)) let friends without Telegram sit in. Running the game on two
clients then became the problem: every feature (settings, timers, stats, voice) was built
twice, and chat messages cannot show what a screen can. From M7 the game runs only in the
web app; Telegram is where people discover A3 Spy and hear about updates. A group of friends who live apart and play every day cannot
play at all without juggling a separate call app next to A3 Spy (M6).

## Settings and personas

A3 Spy serves two settings. The whole group is under 30 people; two tables may play at
once, in either setting.

| Setting | Picture |
| --- | --- |
| **Café table** | 5–10 people around one table, each with a phone, on patchy 4G or café Wi-Fi, playing 3–8 games over 1–2 hours. |
| **Remote table** | 4–10 friends in different places, playing most evenings for 30–60 minutes, each on a phone or laptop over home Wi-Fi or 4G, talking on the room's voice call. |

| Persona | Who | Needs |
| --- | --- | --- |
| **Host** (primary) | Whoever organised the meet-up and sets the pace | Open a room fast, advance phases, still play like everyone else |
| **Player** (primary) | A friend who knows the game | One tap to join, see their secret word, vote fast, see the result |
| Newcomer | A friend of a friend, first time | Understand the rules in 30 seconds; install nothing |
| Latecomer | Arrives mid-game | Wait for the next game without breaking the current one |
| Remote player | A friend playing from home on a remote table | Join the room and the voice call in one go, hear everyone clearly, know whose turn it is to speak |

## Objective (6–12 months)

**A tool for one friend group, built with care.** The group plays every café session and
every remote session with A3 Spy alone, with no other app open. Growth, strangers and revenue are explicitly not objectives.

## North Star — a session with no human game master

At a café meet-up or on a remote evening, the group plays the whole session with A3 Spy and nobody runs the game
by hand. The bars below make that checkable. They are measured from playtests and
anonymous event logs that never contain words or roles.

| Bar | Target |
| --- | --- |
| Time from opening a room to words dealt | < 60 s |
| Games played to a result (not ended early) | > 80 % |
| Games per session | ≥ 3 |
| Missed or failed responses in a session | 0 |
| Balance: spy side wins | 35–55 % of games |
| Remote: time from joining a room to hearing everyone | < 30 s |

A feature that does not move one of these, or a core use case's success criteria, needs a
written reason to exist.

## Non-negotiable

- **Secrets stay secret.** A word or a role is shown only to its owner (on their own
  screen), never to anyone else, never in logs, links or button
  data.
- **Nobody gets stuck.** A missing host, a player who does not vote, a dropped
  connection or a stale button never freezes a game.
- **One game, one truth.** Every player, on whatever client, sees the same room, round and
  result. The pure engine in `src/game` decides; clients only display and send commands.
- **Voice is live only.** Audio is never recorded, stored or transcribed, by A3 Spy or by
  any service it uses.
- **Free to run.** Everything fits Cloudflare's free allowances (Workers, Durable Objects,
  and Realtime for voice) for < 30 users. A design that needs a paid plan or paid usage
  at that scale is rejected.

## Strong defaults (can be challenged, with a written reason)

- **Private screen per player, no shared screen.** Each player uses the web app on their own
  phone. There is no group chat and no "table display" mode.
- **Talk happens out loud, never by text.** At a café, across the table; on a remote table,
  over the voice call built into the room. Nobody needs a separate call app.
- **The host sets the pace.** No timers by default; the host advances phases.
- **One or two taps per phone interaction.** Typing only for a name or Mr. White's guess.
- **No accounts, no passwords.** A player picks
  a name.
- **Vietnamese, playful and short.** Every message or screen reads in 3 seconds.

*Changed 2026-10-17 (M7):* the game runs only in the web app. Telegram no longer runs
rooms; the bot introduces A3 Spy, links to the web app and sends update announcements.

*Changed 2026-10-17:* "Talk happens out loud" became a strong default that covers remote
tables through a voice call built into the room (M6).

*Changed 2026-10-13:* "DM only" was widened to "private screen per player" to allow the web
app ([M3](specs/M3-web-app.md)).

## Non-goals (for now)

- **Playing in Telegram.** The bot is a signpost and an announcement channel, never a game
  client. Every game feature is built once, for the web app.
- **Text or video play.** No describing by chat or typed messages, and no video; remote
  tables talk over voice only.
- **Public release.** No onboarding for strangers, no store listing, no monetisation.
- **Native apps.** The web app is installable as a PWA; no App Store or Play Store build.
- **Profiles and accounts.** Long-term stats exist ([M5](specs/M5-long-term-stats.md)), but there are
  no profiles, no accounts and no per-season boards. Stats were reset when the game moved to
  the web (M7).

*Changed 2026-10-17 (M7):* "playing in Telegram" became a non-goal; the bot's game features
were removed and every room, session and stat recorded before the move was deleted.

*Changed 2026-10-17:* "remote play" was removed from the non-goals: part of the group lives
apart and wants to play every day, which needs voice. It is narrowed to "text or video
play" (M6).

*Changed 2026-10-14:* "long-term stats" was removed from the non-goals: friends asked to
show off across sessions. Profiles and account linking stay out ([M5](specs/M5-long-term-stats.md)).

*Changed 2026-10-13:* "a separate app or website" was removed from the non-goals; a web app
(PWA) is now planned as [M3](specs/M3-web-app.md).

## Quality requirements

| Area | Requirement |
| --- | --- |
| Speed | A tap gets a visible response in < 1 s on normal 4G |
| Availability | Online 24/7 with nobody's machine on; a deploy does not lose games in progress |
| State | A game survives restarts; an abandoned room closes after 6 hours of inactivity |
| Correctness | Simultaneous votes are never lost or double-counted; stale actions from an earlier round are ignored |
| Permissions | Only the host changes settings, advances phases or ends a game; there is no global reset |
| Voice | Audio delay < 500 ms on normal 4G; a dropped voice connection reconnects on its own without leaving the seat; a voice failure never blocks the game |
| Security | Bot token and webhook secret live in a secret store; the webhook checks Telegram's secret header |
