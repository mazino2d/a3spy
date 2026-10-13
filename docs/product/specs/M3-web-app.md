# M3 Web app (PWA)

Status: in progress   ·   Serves: UC-1 – UC-5   ·   Roadmap: Now   ·   Implementation: [M3](../../implementations/M3-web-app.md)

## Problem

Today every player needs Telegram and must have pressed Start in a DM with the bot before
the bot can message them. At a café that leaves people out: a friend of a friend without
Telegram, someone who never opened the bot, someone whose Telegram is on another phone.
The host ends up waiting, explaining, or running a side game by hand, which is exactly
what A3 Spy exists to remove.

Telegram also limits the experience: the word, the vote and the results arrive as chat
messages mixed with everything else in the chat, and there is no way to show a QR code for
the table to scan.

A web app any phone can open, installable as a PWA, lets anyone sit in with one scan and a
name, and gives each phase a screen of its own. Telegram stays a first-class way to play.

## Decisions (2026-10-13, proposed)

| Topic | Decision |
| --- | --- |
| Rooms | **Mixed tables.** Web and Telegram players join the same rooms and play the same game; a room has no "type". |
| Identity | **Guest by name.** A web player types a display name once; the device keeps a session so the player returns to their seat. No accounts, no passwords, no email. |
| Telegram link | Not in M3. A web player and a Telegram player are different people to A3 Spy even if they are the same friend. Linking (e.g. Telegram Login) is a Later item. |
| Joining | A room link `https://<web host>/r/<code>` and a QR code of it. The code is the same 4 characters as on Telegram, so `/join <code>` and the web link reach the same room. |
| Secrecy | The word or role is sent only to its owner's device, shown only after a tap to reveal, and hidden again after a few seconds. It is never in a URL, never cached for offline use, never in logs. |
| Offline | **Online only.** The app shell loads instantly from cache, but playing needs a connection. There is no offline game. |
| Notifications | None. The phone is on the table; screens update live while the app is open. |
| Language | Vietnamese only, same voice as the bot. |
| Platforms | Recent Chrome on Android and Safari on iOS (the group's phones). Installable on both; works in the browser without installing. |
| Cost | Free plan only: same Worker, same Durable Objects. |

## User stories

Story IDs use the new epic letter `W` (web). Each becomes a GitHub issue in milestone M3.

| ID | Story | Priority |
| --- | --- | --- |
| W1 | As a player without Telegram, I scan the table's QR code, type my name and land in the lobby. | Must |
| W2 | As a host on the web, I open a room and show a QR code and a link for the table. | Must |
| W3 | As a web player, I see my word in secret and can see it again any time. | Must |
| W4 | As a web player, I see the speaking order and vote with one tap. | Must |
| W5 | As a web player, I see who was eliminated, the result and the reveal; as host, I advance phases, play again and end the game. | Must |
| W6 | As an eliminated Mr. White on the web, I type my guess. | Must |
| W7 | As a table, we play one game with some players on Telegram and some on the web. | Must |
| W8 | As a web player, I get my seat back after a reload, a locked phone or a dropped connection. | Must |
| W9 | As a regular, I install the app on my home screen and it opens straight to my room or the home screen. | Should |
| W10 | As a web player, I see the room's scoreboard. | Should |

## Acceptance criteria

### Joining (W1, W2)

- **AC1** Given a phone with no session, when the player opens a room link or scans its QR
  code, then they see one screen asking for a name; after typing it and tapping Join they
  are in that room's lobby. No other screen comes first.
- **AC2** Given a name that is empty, only spaces or longer than 24 characters, when the
  player taps Join, then they cannot join and see why in one line. Leading and trailing
  spaces are trimmed.
- **AC3** Given the web home screen, when a player taps Create room, then a room opens with
  them as host and the lobby shows the room code, a QR code of the room link and a Share
  button (system share sheet where available, copy link otherwise).
- **AC4** Given the home screen, when a player types a 4-character code that exists, then
  they join that room; when it does not exist, they see "room not found" and stay.
- **AC5** Given a player already in another room, when they open a different room's link,
  then they are asked to leave the current room first; they are never in two rooms.
- **AC6** Given a lobby, when anyone joins or leaves on either client, then every web
  lobby updates within 1 s without a reload.

### Secret word (W3)

- **AC7** Given a dealt game, when a web player opens the game screen, then their word card
  is face down and shows the same layout for civilians and spies; Mr. White's card says
  they are Mr. White.
- **AC8** Given a face-down card, when the player taps it, then the word shows and hides
  again after 5 s or on the next tap.
- **AC9** Given any game, then a player's word or role is never sent to another player's
  device, never in a URL or page title, and never stored by the app for offline use.
  Other players' roles reach a device only when the rules reveal them (elimination, end of
  game).

### Rounds (W4, W5, W6)

- **AC10** Given a round starts, then every web player sees the speaking order of living
  players, highlighting their own position.
- **AC11** Given the host taps Open vote, then each living web player sees one button per
  candidate (not themselves), taps one to vote, sees their choice, and can change it until
  the vote closes. Eliminated players see the round but no vote buttons.
- **AC12** Given a vote is open, then the host sees the count (`5/7`) and a Close button,
  never who voted for whom.
- **AC13** Given the vote closes, then every player on either client sees the same result
  (vote count per player, who is out and their role, or the tie / no-elimination outcome)
  at the same time.
- **AC14** Given an eliminated web Mr. White, then they see a text field for one guess and
  everyone else sees that the room is waiting for it; matching follows the rules.
- **AC15** Given the game ends, then every web player sees the winning side, every role and
  both words; the host sees Play again; `End game` is available to the host at any time
  during a game and asks for confirmation.
- **AC16** Given a button from an earlier round or game (e.g. a screen left open), when it
  is tapped, then nothing changes and the screen refreshes to the current state.

### Mixed rooms (W7)

- **AC17** Given a room with Telegram and web players, then the game behaves exactly as if
  everyone were on one client: same order, same vote, same results, same scoreboard.
- **AC18** Given a Telegram lobby, then it also shows the room's web link; given a web
  lobby, then it also shows the Telegram invite link.
- **AC19** Given a web player and a Telegram player with the same display name, then both
  are shown distinguishably (e.g. a suffix) in every list and vote.

### Reconnecting (W8)

- **AC20** Given a web player in a room, when they reload, close and reopen the tab, or
  come back after the phone was locked, then within 2 s of the page loading they see the
  current state of their room, including their word, with no new name prompt.
- **AC21** Given the connection drops, then the screen says so in one line and reconnects
  on its own; taps made while offline are not silently lost (they are disabled or retried).
- **AC22** Given a web player who closed the tab mid-game, then they stay in the game; the
  room does not wait for them more than for a Telegram player who put the phone down.

### Install and score (W9, W10)

- **AC23** Given Android Chrome or iOS Safari, then the app can be added to the home screen
  with the A3 Spy icon and name, and opens full screen.
- **AC24** Given an installed app with a session in a room, when it opens, then it shows
  that room; otherwise the home screen.
- **AC25** Given a room, then any web player can open the scoreboard (games won per player)
  in one tap.

## Edge cases checklist

- Two tabs or two phones with the same session: the latest one wins the seat; the older
  one shows that it was taken over.
- A web player clears site data mid-game: they are a new guest; their old seat behaves like
  a player who stopped responding until the host continues or they leave.
- Room closes (idle 6 h, last player leaves) while a web player is away: reopening shows
  "room closed" and the home screen.
- Host on the web leaves: host passes as usual; the new host may be on Telegram.
- iOS: no install prompt exists, so the home screen shows a one-line "Share → Add to Home
  Screen" hint on Safari only, dismissed for good after one tap.
- Long Vietnamese names and words fit the card and buttons without overflow.
- Screen readers: the word card announces "tap to reveal", never the word, when face down.

## Success check

- A playtest at the café with at least 2 web players and 3 Telegram players finishes
  3 games with no human fixing anything (North Star: 0 missed responses, < 60 s to deal).
- A friend who has never used A3 Spy joins by QR in < 30 s, timed.

## Out of scope

- Telegram Login or any account linking; merged scores across clients.
- Push notifications, sounds, timers.
- A shared "table screen" showing the game for everyone.
- English UI.

## Open questions

- Web host name: the `workers.dev` URL, or a custom domain from `everything-as-code`?
  Default: `workers.dev` until a domain is chosen; links stay valid only if the host does
  not change, so decide before inviting the group.
- Should web players see the Telegram invite at all, or only the web link? Default: both
  (AC18).
