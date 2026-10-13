# Game rules

Canonical rules for code and tests, the same on every client. Product context and rationale live in [docs/product/](product/index.md); a rule changes together with the milestone spec that changes it, in the same PR.

## Rooms

- Everyone plays through a **private chat (DM) with the bot**. There is no group chat.
- `/newgame` creates a room with a 4-character code and an invite link `t.me/<bot>?start=<code>`. The creator is the **host** and joins automatically.
- Players join with the invite link or `/join <code>`. A player is in at most **one room** at a time.
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
- More than 12: the bot warns and suggests splitting, but allows it (keep the 10–12 counts).
- The host may change the counts in the lobby as long as civilians > spies + Mr. White.

## A round

1. **Describe** — the bot sends the speaking order of living players to everyone: random in round 1, then the previous order rotated by one (eliminated players removed), so a different person opens each round. Mr. White is never first. People speak out loud.
2. **Discuss** — free talk; the bot does nothing.
3. **Vote** — the host opens the vote. Each living player gets buttons with the other living players' names, votes once, may change their vote until it closes. Nobody sees who voted for whom; the host sees the count (`5/7`).
4. **Close** — when every living player has voted, or the host presses close.
5. **Eliminate** — the player with the most votes is eliminated and their role is revealed to everyone.
   - Tie: one revote among the tied players only (tied players still vote). Still tied: nobody is eliminated, next round.
   - Nobody voted: nobody is eliminated, next round.
6. **Mr. White guess** — if Mr. White was eliminated, they type one guess in DM. Match ignores case, surrounding/duplicate spaces and Vietnamese diacritics are **not** ignored. Correct: Mr. White wins alone, game ends.
7. **Win check** — civilians win if no spy and no Mr. White is alive; the spy side wins if civilians alive ≤ spies + Mr. White alive. Otherwise the next round starts.

Eliminated players stop describing and voting but stay in the room.

## End of game

- The bot reveals every role and both words to the room.
- **Play again** keeps players and settings, adds the waiting list, and draws a pair not used in this room in the last 24 hours.
- `/end` (host only) ends the game early with a full reveal; it does not count as a win for anyone.

## Score

`/score` shows **games won per player** in the room. A win counts for every player on the winning side, alive or not. No points by role.

## Words

- Packs live in `words/*.json`, one theme per file, as pairs of similar words.
- A pair is two words of the same kind that share 2–3 easy-to-describe traits and differ in 1–2 details (`Trà sữa` / `Cà phê sữa`).
- The host picks one or more themes; default is all themes.
- What makes a good pair, and the themes: [word packs](product/word-packs.md).
