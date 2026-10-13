# Product strategy

> Source of truth for product decisions. The `product-owner` skill reads this file before
> triaging, writing specs or reordering the roadmap. Change it deliberately: every change
> here shifts what gets built.

Last reviewed: 2026-10-13

## Vision

Everyone at the table plays, nobody runs the game. A3 Spy is the game master for *Who is
Spy* (Undercover rules) when a group of friends plays together in person: people describe
and argue out loud, and A3 Spy deals the secret words, calls the speaking order, runs the
vote, eliminates, reveals and keeps score.

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

[M1](specs/M1-telegram-game-master.md) fixed all five on Telegram. The open problem is
reach: a friend without Telegram, or who never opened the bot, cannot sit in
([M3](specs/M3-web-app.md)).

## Setting and personas

5–10 people around a café table, each with a phone, on patchy 4G or café Wi-Fi, playing
3–8 games over 1–2 hours. The whole group is under 30 people; two tables may play at once.

| Persona | Who | Needs |
| --- | --- | --- |
| **Host** (primary) | Whoever organised the meet-up and sets the pace | Open a room fast, advance phases, still play like everyone else |
| **Player** (primary) | A friend who knows the game | One tap to join, see their secret word, vote fast, see the result |
| Newcomer | A friend of a friend, first time | Understand the rules in 30 seconds; install nothing |
| Latecomer | Arrives mid-game | Wait for the next game without breaking the current one |

## Objective (6–12 months)

**A tool for one friend group, built with care.** The group plays every café session with
A3 Spy alone. Growth, strangers and revenue are explicitly not objectives.

## North Star — a session with no human game master

At a café meet-up, the group plays the whole session with A3 Spy and nobody runs the game
by hand. The bars below make that checkable. They are measured from playtests and
anonymous event logs that never contain words or roles.

| Bar | Target |
| --- | --- |
| Time from opening a room to words dealt | < 60 s |
| Games played to a result (not ended early) | > 80 % |
| Games per session | ≥ 3 |
| Missed or failed responses in a session | 0 |
| Balance: spy side wins | 35–55 % of games |

A feature that does not move one of these, or a core use case's success criteria, needs a
written reason to exist.

## Non-negotiable

- **Secrets stay secret.** A word or a role is shown only to its owner (their Telegram DM,
  a popup, or their own screen), never to anyone else, never in logs, links or button
  data.
- **Nobody gets stuck.** A missing host, a player who does not vote, a dropped
  connection or a stale button never freezes a game.
- **One game, one truth.** Every player, on whatever client, sees the same room, round and
  result. The pure engine in `src/game` decides; clients only display and send commands.
- **Free to run.** Everything fits the Cloudflare Workers free plan for < 30 users. A
  design that needs a paid plan at that scale is rejected.

## Strong defaults (can be challenged, with a written reason)

- **Private screen per player, no shared screen.** Each player uses their own phone: a DM
  with the bot or the web app. There is no group chat and no "table display" mode.
- **The host sets the pace.** No timers by default; the host advances phases.
- **One or two taps per phone interaction.** Typing only for a name or Mr. White's guess.
- **No accounts, no passwords.** Telegram identifies Telegram players; a web player picks
  a name.
- **Vietnamese, playful and short.** Every message or screen reads in 3 seconds.

*Changed 2026-10-13:* "DM only" was widened to "private screen per player" to allow the web
app ([M3](specs/M3-web-app.md)).

## Non-goals (for now)

- **Remote play.** No describing through the app, no voice or video; talk happens out loud.
- **Public release.** No onboarding for strangers, no store listing, no monetisation.
- **Native apps.** The web app is installable as a PWA; no App Store or Play Store build.
- **Profiles and accounts.** Long-term stats exist ([M5](specs/M5-long-term-stats.md)), but there are
  no profiles, no account linking between Telegram and the web, and no per-season boards.

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
| Security | Bot token and webhook secret live in a secret store; the webhook checks Telegram's secret header |
