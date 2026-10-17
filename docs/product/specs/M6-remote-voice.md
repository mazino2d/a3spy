# M6 Remote play with voice

Status: ready   ·   Serves: UC-1 – UC-5, UC-9   ·   Roadmap: Now   ·   Implementation: [M6](../../implementations/M6-remote-voice.md)

## Problem

Part of the group lives apart and wants to play most evenings. A3 Spy already deals the
words, runs the vote and keeps score on each player's own screen, but the game is talking:
without a voice call there is no game. Today they would have to open a separate call app,
share its link, and keep two apps in sync by hand, which is the kind of running the game
that A3 Spy exists to remove.

A room the host marks as online gets its own voice call. Everyone in the room joins it
with one tap and talks freely, as if they sat at the same table.

## Decisions (2026-10-17)

| Topic | Decision |
| --- | --- |
| Which rooms | **Host setting "Chơi online", off by default.** Café rooms never ask for the microphone and never risk echo between phones at the same table. |
| When it can change | In the lobby only, like every other host setting (rules: settings cannot change while a game is running). Kept for play again and a change of host. *Proposed.* |
| Who is in the call | Everyone in the room: living, eliminated and waiting-list players. Nobody outside the room can join or listen. |
| Microphones | **Open mic, like a café table.** Each player mutes and unmutes themselves; A3 Spy never mutes anyone. The screen shows who is in the call, who is muted and who is talking right now. Eliminated players can still talk. |
| Media | Audio only, no video. Never recorded, stored or transcribed (strategy: voice is live only). |
| Web players | Join the call from the room screen with one tap; the call stays up across every phase. |
| Telegram players | The bot sends a **Vào voice** button that opens the web app on a voice page for their own seat. They keep reading their word and voting in Telegram; the voice page shows only the call. No account linking. |
| Size | Clear audio for up to 10 people in one call (the remote table setting is 4–10). |
| Cost | Free allowances only (strategy: free to run). How audio is routed is an engineering decision in the implementation plan. |

## User stories

Story IDs use the new epic letter `V` (voice). Each becomes a GitHub issue in milestone M6,
label `epic:voice`.

| ID | Story | Priority |
| --- | --- | --- |
| V1 ([#52](https://github.com/mazino2d/a3spy/issues/52)) | As a host, I turn on "Chơi online" in the lobby so my room gets a voice call. | Must |
| V2 ([#53](https://github.com/mazino2d/a3spy/issues/53)) | As a web player in an online room, I join the call with one tap and hear everyone. | Must |
| V3 ([#54](https://github.com/mazino2d/a3spy/issues/54)) | As a player in the call, I mute and unmute myself and see who is in the call, who is muted and who is talking. | Must |
| V4 ([#55](https://github.com/mazino2d/a3spy/issues/55)) | As a Telegram player in an online room, I tap one button and join the call for my seat without making a web account. | Must |
| V5 ([#56](https://github.com/mazino2d/a3spy/issues/56)) | As a player whose connection drops, I get back into the call on my own and the game never waits for voice. | Must |
| V6 ([#57](https://github.com/mazino2d/a3spy/issues/57)) | As a player at a remote table, I get a one-line tip to wear headphones so the call has no echo. | Should |

## Acceptance criteria

### Turning voice on (V1)

- **AC1** Given a new room, then "Chơi online" is off, nobody is asked for microphone access
  and nothing about voice is shown besides the setting itself.
- **AC2** Given the host's lobby on either client, when the host turns "Chơi online" on or
  off, then every lobby shows the new value within 1 s; only the host sees the control.
- **AC3** Given a game is running, then the host cannot change "Chơi online"; the call stays
  as it is until the game ends.
- **AC4** Given the host turns "Chơi online" off in the lobby, then every player is removed
  from the call and sees that voice is off.
- **AC5** Given play again or a change of host, then "Chơi online" keeps its value.

### Joining the call (V2, V4)

- **AC6** Given an online room, when a web player taps **Vào voice** and allows the
  microphone, then they hear and are heard by everyone already in the call within 10 s on
  normal 4G.
- **AC7** Given a web player in the call, when the phase changes (lobby, round, vote,
  result, end, play again), then the call continues without a break.
- **AC8** Given a Telegram player in an online room, then their lobby message and every
  round message carry a **Vào voice** button; tapping it opens a voice page for their own
  seat in the browser, with no name prompt, and AC6 applies.
- **AC9** Given a voice page opened from Telegram, then it shows the call only (who is in,
  muted, talking; mute button; leave), never the player's word, role or vote buttons.
- **AC10** Given a **Vào voice** link from Telegram, then it works only for that player and
  only while they are in that room; opened by anyone else, after they leave, or after the
  room closes, it shows that the link is no longer valid. The link never contains a word
  or role.
- **AC11** Given a person not in the room, then they cannot join the call or hear it, even
  with the room code.
- **AC12** Given a player who denies microphone access, then they see one line on how to
  allow it, and they can still listen.

### In the call (V3, V6)

- **AC13** Given an online room, then every player list (lobby, speaking order, vote
  candidates) shows for each player whether they are in the call, muted, or talking now;
  the "talking" mark appears within 1 s of them starting to talk.
- **AC14** Given a player in the call, when they tap mute, then nobody hears them and every
  player sees them as muted; tapping again unmutes.
- **AC15** Given a player is eliminated or on the waiting list, then they stay in the call
  and can talk; A3 Spy never mutes anyone.
- **AC16** Given a player joins the call for the first time on a device, then they see one
  line suggesting headphones; it is not shown again on that device.
- **AC17** Given audio from one player, then others hear it with less than 500 ms delay on
  normal 4G.

### Drops and failures (V5)

- **AC18** Given a player in the call loses the connection, then their mark shows
  "reconnecting" to others, and they rejoin the call on their own within 10 s of the
  connection coming back, with their mute state kept.
- **AC19** Given voice fails for any player (denied microphone, network, unsupported
  browser), then the game itself behaves exactly as without voice: dealing, voting and
  results never wait for the call.
- **AC20** Given a web player who reloads or reopens the app in an online room, then they
  are back in their seat and see **Vào voice** to rejoin with one tap (browsers require a
  tap before playing audio).
- **AC21** Given the room closes or a player leaves the room, then they leave the call.

### Secrecy and privacy

- **AC22** Given any call, then no audio is recorded, stored or sent anywhere but to the
  other people in that call.
- **AC23** Given voice is on, then words and roles still reach only their owner exactly as
  before; the voice page and voice links never carry them.

## Edge cases checklist

- Room: join twice (one seat, one call connection); join another room (leaves the first
  call); join mid-game (waiting list, can join the call); host leaves (call goes on; new
  host owns the setting); last player leaves or idle close (call ends).
- Round: voice has no round state, so stale actions do not apply; an old **Vào voice**
  button from an earlier round still opens the current call while the player is in the
  room (AC10).
- Secrecy: AC22, AC23.
- Clients: web only, Telegram only (everyone uses voice pages), mixed table; reconnect
  (AC18, AC20); same display name twice (the call shows the same suffixed names as the
  lobby).
- Same seat in two tabs or devices: the latest one takes the call, like the seat itself
  (M3); the older one leaves the call.
- Player count: 3 (fine); 10 (AC6, AC17 must hold); 11+: allowed, quality not promised,
  the host sees one line saying so.
- Café room with "Chơi online" on by mistake: echo is the players' problem; the host turns
  it off in the lobby (AC4).
- Copy: Vietnamese, short: "Chơi online", "Vào voice", "Tắt mic", "Bật mic",
  "Đang kết nối lại…", "Nên đeo tai nghe để không bị vọng tiếng".

## Success check

- A remote evening with 6+ players on at least 3 different networks plays 3 games with
  nobody opening another call app, and every player hears everyone within 30 s of joining
  the room (North Star, remote bar).
- At least one player on Telegram and one on iPhone take part in that evening.
- After a month of evenings, Cloudflare Realtime usage is under 10 % of its free allowance.

## Out of scope

- Video, screen sharing, text chat.
- A3 Spy muting players (turn-based microphones, muting eliminated players). Rejected
  2026-10-17: it kills the arguing that makes the game fun.
- A "current speaker" pointer that moves through the speaking order.
- Telegram Mini App or a Telegram group voice chat.
- Push-to-talk, noise gates or volume per player.

## Open questions

- **iPhone + Telegram:** iOS may pause the browser call when the player switches to Telegram
  to read the word or vote. Default: accept it for M6, recommend remote players on iPhone
  use the web app for the whole game, and measure in the first remote evening.
- Should an online room's lobby suggest "Chơi online" automatically when players join from
  far apart? Default: no, the host decides.
