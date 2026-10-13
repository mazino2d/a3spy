# Use cases and success criteria

Core use cases carry measurable success criteria; a change that regresses one is a bug.
Supporting use cases must work correctly but are optimised only when it costs the core
nothing.

Criteria marked *(M3)* belong to the web app ([spec](specs/M3-web-app.md)) and are not
built yet. "Any client" means Telegram and, once M3 ships, the web app.

## Core

### UC-1 Start a game

> As the host, I get the whole table into a room and dealt in before anyone gets bored.

| # | Success criterion |
| --- | --- |
| 1.1 | From opening a room to words dealt: < 60 s for 6 players. |
| 1.2 | A player joins with one tap on an invite link (or a code); joining twice never adds them twice. |
| 1.3 | Everyone in the room sees the lobby update live, with correct display names. |
| 1.4 | The game cannot start with fewer than 3 players; above 12 it warns and still allows it. |
| 1.5 | A player without Telegram joins by scanning a QR code or opening a link and typing a name. *(M3)* |

### UC-2 Get my word in secret

> As a player, I read my word without the person next to me seeing it.

| # | Success criterion |
| --- | --- |
| 2.1 | Each player's word or role reaches only that player, on any client. |
| 2.2 | Civilians and spies see the same format, so a spy cannot tell from the message or screen. |
| 2.3 | The word can be seen again in one tap without scrolling. |
| 2.4 | On the web, the word is hidden until the player taps to reveal it and hides again on its own. *(M3)* |

### UC-3 Play a round

> As the table, we describe, argue, vote and see who goes out, without anyone keeping count.

| # | Success criterion |
| --- | --- |
| 3.1 | Each round starts with the speaking order of living players; Mr. White never speaks first. |
| 3.2 | Voting is one tap; a vote can be changed until it closes; nobody sees who voted for whom. |
| 3.3 | The vote closes when everyone has voted or the host closes it; ties follow [the rules](../rules.md#a-round). |
| 3.4 | Everyone sees who was eliminated and their role at the same time. |
| 3.5 | An eliminated Mr. White can type one guess; the room waits for it. |
| 3.6 | Every tap gets a response in < 1 s; stale actions from an earlier round are ignored. |

### UC-4 Finish and play again

> As the table, we see who won and start the next game without setting up again.

| # | Success criterion |
| --- | --- |
| 4.1 | At the end, everyone sees the winning side, every role and both words. |
| 4.2 | Play again keeps players and settings, adds the waiting list, and draws a pair not played in the room in the last 24 hours. |
| 4.3 | The host can end a game early; no win is counted. |

## Supporting

### UC-5 Join late or leave

| # | Success criterion |
| --- | --- |
| 5.1 | Joining during a game puts the player on a waiting list; they are dealt in at the next game. |
| 5.2 | A player who leaves mid-game counts as eliminated; their role is revealed. |
| 5.3 | If the host leaves, host rights pass to the earliest remaining joiner. |
| 5.4 | A web player who reloads, locks the phone or loses the connection returns to the same seat. *(M3)* |

### UC-6 Keep score

| # | Success criterion |
| --- | --- |
| 6.1 | The room scoreboard shows games won per player. |

### UC-7 Configure a game

| # | Success criterion |
| --- | --- |
| 7.1 | The host can pick word themes, the number of spies and Mr. White on or off before starting; defaults follow the role table. *(M2)* |

### UC-8 Add word pairs

| # | Success criterion |
| --- | --- |
| 8.1 | Anyone adds pairs by PR to `words/*.json`; tests reject malformed packs. See [word packs](word-packs.md). |
