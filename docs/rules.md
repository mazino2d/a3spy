# Game rules

Canonical rules for code and tests, the same on every client. Product context and rationale live in [docs/product/](product/index.md); a rule changes together with the milestone spec that changes it, in the same PR.

## Rooms

- Everyone plays on **their own phone**, in the web app. There is no group chat and no shared screen. (Since M7 the Telegram bot runs no games; it links to the web app and sends announcements.)
- **Mở phòng mới** creates a room with a 4-character code and a room link `https://<host>/r/<code>`, also shown as a QR code. The creator is the **host** and joins automatically.
- Players join with the room link, the QR code or the code. A player is in at most **one room** at a time. A player picks a display name; there are no accounts. An old Telegram invite link `t.me/<bot>?start=<code>` answers with a button to the room link.
- Two players with the same display name are told apart by a suffix: `Minh`, `Minh (2)`.
- Joining while a game is running puts the player in the **waiting list**; they are dealt in at the next game.
- If the host leaves, the earliest remaining joiner becomes host. An empty room closes.
- A room with no activity for **6 hours** closes.

## Roles

| Role | Receives | Knows their role? | Wins when |
|------|----------|-------------------|-----------|
| Civilian | Word A | No | Every spy and Mr. White is eliminated |
| Spy | Word B, similar to A | No | Civilians alive ≤ spies + Mr. White alive |
| Mr. White (optional) | No word | Yes | With the spies; or alone, by guessing word A after being eliminated |

Civilians and spies get the **same message format** ("Từ của bạn: X") so a spy cannot tell from the message. Which word of the pair goes to civilians is random.

### Default role counts

| Players | Spies | Mr. White |
|---------|-------|-----------|
| 3–4 | 1 | 0 |
| 5–6 | 1 | 1 |
| 7–9 | 2 | 1 |
| 10–12 | 3 | 1 |

- Fewer than 3 players: the game cannot start.
- More than 12: the host is warned and the app suggests splitting, but allows it (keep the 10–12 counts).

### Host settings

Before a game, in the lobby, the host can change:

- **Spies**: 1–5. **Mr. White**: on or off (at most one).
- **Themes**: any non-empty set of word packs; all of them by default.
- **Timers** (see below): discussion off/2/3/5 minutes, vote off/1/2 minutes; both off by default.
- **Chơi online** (see [Voice](#voice)): on or off; on by default (M8).
- Counts follow the table above as players join or leave, until the host changes spies or Mr. White; from then on they stay as set, until the host taps **Tự động** to follow the table again.
- Start is refused unless civilians > spies + Mr. White; the host sees why.
- Settings belong to the room: they survive play again and a change of host, and cannot change while a game is running.

## A round

1. **Describe** — every player sees a suggested speaking order of living players to everyone: random in round 1, then the previous order rotated by one (eliminated players removed), so a different person opens each round. Mr. White is never first. People talk freely, out loud or on the call; the order only says who opens, and nobody waits for a turn.
2. **Discuss** — free talk; A3 Spy does nothing.
3. **Vote** — the host opens the vote. Each living player gets buttons with the other living players' names, votes once, may change their vote until it closes. Nobody sees who voted for whom; the host sees the count (`5/7`).
4. **Close** — when every living player has voted, or the host presses close.
5. **Eliminate** — the player with the most votes is eliminated and their role is revealed to everyone.
   - Tie: one revote among the tied players only (tied players still vote). Still tied: nobody is eliminated, next round.
   - Nobody voted: nobody is eliminated, next round.
6. **Mr. White guess** — if Mr. White was eliminated, they type one guess. Match ignores case, surrounding/duplicate spaces and Vietnamese diacritics are **not** ignored. Correct: Mr. White wins alone, game ends.
7. **Win check** — civilians win if no spy and no Mr. White is alive; the spy side wins if civilians alive ≤ spies + Mr. White alive. Otherwise the next round starts.

Eliminated players stop describing and voting but stay in the room.

## Timers

Timers only remind; the host still opens and closes the vote.

- A **discussion** timer starts when a round starts. If the vote is still not open when it ends, every player is told time is up and the host gets the Open vote button.
- A **vote** timer starts when a vote or revote opens. If that vote is still open when it ends, every player is told time is up and the host gets the Close vote button.
- If the phase moves on before the end, there is no reminder. A reminder never opens or closes a vote or eliminates anyone.

## Voice

An online room (host setting **Chơi online**) has one audio-only voice call.

- Everyone in the room may join it: living, eliminated and waiting-list players. Nobody outside the room can join or listen.
- Players join the call from the room screen. Words, roles and votes are never part of the call.
- Microphones are open: each player mutes and unmutes themselves; A3 Spy never mutes anyone.
- The game never waits for voice: dealing, voting and results behave the same whether or not anyone is in the call.
- Audio is never recorded, stored or transcribed.

## End of game

- Everyone sees every role and both words.
- **Play again** keeps players and settings, adds the waiting list, and draws a pair not used in this room in the last 24 hours.
- **Kết thúc ván** (host only) ends the game early with a full reveal; it does not count as a win for anyone.

## Score

The room **scoreboard** shows **games won per player** in the room. A win counts for every player on the winning side, alive or not. No points by role.

**Long-term stats** (the Stats screen) count every game that ended with a winner, across rooms: games, wins and win rate; as spy, games and wins; as Mr. White, games, wins and correct guesses. A game ended early counts for nobody. Stats were reset when the game moved to the web (M7). The leaderboard ranks the top 10 by wins, then win rate.

## Words

- Packs live in `words/*.json`, one theme per file, as pairs of similar words.
- A pair is two words of the same kind that share 2–3 easy-to-describe traits and differ in 1–2 details (`Trà sữa` / `Cà phê sữa`).
- The host picks one or more themes; default is all themes.
- A pair is drawn from the chosen themes, avoiding pairs played in the room in the last 24 hours; if all of them were, the pairs played longest ago come back first.
- What makes a good pair, and the themes: [word packs](product/word-packs.md).
