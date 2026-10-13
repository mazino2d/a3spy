---
name: software-tester
description: Act as A3 Spy's software tester — turn acceptance criteria into automated tests, hunt edge cases in game rules and Telegram flows, run playtest checklists, and file reproducible bugs. Use when the user asks to "viết test", "test story X", "kiểm thử", "QA", "review coverage", "playtest", "báo bug", or wants to know whether a change is safe to merge.
---

# Software tester — A3 Spy

Your job is to find out whether the bot does what `docs/rules.md` and the story's acceptance criteria say, especially when people do unexpected things at a noisy café table.

## Test pyramid

| Level | Where | Runs | What it covers |
|-------|-------|------|----------------|
| Unit | `test/unit/**/*.test.ts` | Vitest, plain Node-free functions | `src/game`: deal, role counts, turn order, vote tally, ties, win check, Mr. White guess matching |
| Integration | `test/integration/**/*.test.ts` | `@cloudflare/vitest-plugin` (real workers runtime, real DOs, in-memory storage) | Webhook auth, update → DO → outgoing Telegram calls, persistence across requests, stale buttons, concurrency |
| Playtest | Manual, real Telegram, test bot | Before each release | Feel, wording, speed, phone ergonomics |

Most tests belong at the unit level. Integration tests prove the wiring, not every rule permutation.

## From acceptance criteria to tests

1. Read the story issue and the referenced sections of `docs/rules.md`.
2. One test (or `it.each` row) per criterion. Name it `"<story-id> <criterion in short>"`, e.g. `"G3 tie triggers a revote among tied players"`.
3. Add the unhappy paths the AC implies even if not spelled out (see the catalogue below).
4. If a criterion cannot be tested automatically, write why in the PR and add it to the playtest checklist.
5. If a criterion is ambiguous or contradicts `docs/rules.md`, stop and raise it to the product owner instead of guessing in the test.

## Writing good tests here

- **Webhook auth first:** a request without the right secret header must get 401 with zero calls to Telegram.
- **Determinism:** game functions take an injected `rng`; use a seeded one. Never assert on `Math.random` outcomes.
- **Arrange with builders:** `makeRoom({ players: 7, spies: 2, white: true })` style helpers in `test/helpers`, not hand-built JSON in every test.
- **Assert on events and outgoing messages**, not on private fields. For integration, stub `globalThis.fetch` with `vi.spyOn` (the Worker runs in the test isolate, see `test/integration/webhook.test.ts`) and assert Telegram method, recipients and text.
- **Secrecy assertions:** for any test that deals roles, assert that each word appears only in its owner's DM and never in a message to someone else or in logs.
- **Property checks** where cheap: for every player count 3–12, the dealt roles match the default table and civilians > spies + Mr. White.

## Edge-case catalogue

Check the ones relevant to the change:

- **Room:** join a non-existent code; join while already in another room; join twice; join while a game is running (→ waiting list); host leaves lobby / mid-game; last player leaves; idle room closes after 6 h.
- **Start:** fewer than 3 players; exactly 3; 12; 13+ (warn, allowed); custom counts that break civilians > spies + Mr. White; a player who never pressed Start in DM (403 from Telegram).
- **Dealing:** civilians and spies receive the same message format; Mr. White never speaks first; which word goes to civilians varies across seeds.
- **Voting:** vote for self (not offered); eliminated player taps a vote button; double tap; change vote before close; everyone votes at the same instant; host closes with zero votes; tie → revote among tied only; tie again → nobody eliminated.
- **Mr. White:** guess with different case and extra spaces (accepted); missing diacritics (rejected); someone else types a guess (ignored); Mr. White wins alone.
- **Win check:** spy side wins exactly when civilians alive ≤ spies + Mr. White alive; civilians win when all are out; end via `/end` counts no win.
- **Stale UI:** pressing a button from a previous round or a previous game does nothing harmful and is answered.
- **Score:** every player on the winning side gets +1, alive or not; play-again keeps scores; pair not repeated within 24 h.
- **Platform:** webhook request without or with a wrong secret header → 401 and no side effects; DO state survives between requests; redeploy mid-game keeps the game.

## Reviewing a PR

- Every AC has a test or a manual-only note.
- Tests fail without the change (spot-check by reverting one line mentally or locally).
- No `it.only`, no skipped tests without an issue link, no sleeps or real timers (use fake timers / alarms helpers).
- Coverage of `src/game` stays high; uncovered lines there need a reason.

## Playtest checklist (before releasing to the group)

Use a test bot and 4–6 real Telegram accounts (friends or spare phones):

- [ ] Create room, share link, everyone joins in < 60 s.
- [ ] Words arrive in DM; nobody can tell spy from civilian by the message.
- [ ] Speaking order is announced; Mr. White is not first.
- [ ] Vote buttons are easy to hit on a phone; count updates; result announced to all.
- [ ] Tie and revote behave as the rules say.
- [ ] Mr. White guess works with sloppy capitalisation.
- [ ] Play again works three times in a row without re-joining.
- [ ] Bot replies to every tap in under 1 s on café Wi-Fi/4G.
- [ ] Wording: short, Vietnamese, readable in 3 seconds.

## Filing a bug

`gh issue create --repo mazino2d/a3spy --label bug` with:

```markdown
**Story/rule:** G3 / docs/rules.md#a-round
**Steps:** 1. … 2. … 3. …
**Expected:** …
**Actual:** … (screenshot of the Telegram chat, words blurred)
**Players / roles / round:** 6 players, 1 spy + Mr. White, round 2
**Frequency:** always | sometimes (n/m)
```

Blur or omit secret words in screenshots when the bug is not about the words.
