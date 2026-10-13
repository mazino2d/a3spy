# Roadmap and backlog

Maintained by the `product-owner` skill. Ordered by RICE-lite score within each horizon.

**RICE-lite score = Impact × Confidence ÷ Effort**

| Factor | Scale |
| --- | --- |
| Impact — effect on a North Star bar or a core use case criterion | 3 massive · 2 high · 1 medium · 0.5 low · 0.25 minimal |
| Confidence — how sure we are about impact and effort | 1.0 high · 0.8 medium · 0.5 low |
| Effort — focused person-days, including tests and docs | number, ≥ 0.5 |

Reach is omitted: there is one friend group and no usage data, so it would be the same
guess for every item.

Items are **milestones** `M<n>`, numbered in the order they were triaged. Each is a GitHub
milestone; its stories are issues in that milestone (story IDs like `L1`, `G2`, `W3`).
Each milestone has a spec in [specs/](specs/), and large ones an implementation plan in
[../implementations/](../implementations/).

## Shipped

| ID | Item | Serves | Notes |
| --- | --- | --- | --- |
| M1 | Telegram game master: rooms, dealing, rounds, vote, elimination, Mr. White, reveal, play again, score | UC-1 – UC-6 | Shipped 2026-10-13 (#20) with every Must plus L5, R2, G4, E4, S1. Spec: [M1](specs/M1-telegram-game-master.md). Implementation: [M1](../implementations/M1-telegram-game-master.md). |
| M2 | Host settings: spies, Mr. White and themes, on Telegram and the web (L4 [#5](https://github.com/mazino2d/a3spy/issues/5)) | UC-7 | Shipped 2026-10-13 (#41). Playtest fixes go into a new milestone when feedback arrives. Open: whether Mr. White should default on at 5–6 players, decided from the balance bar once there is playtest data. Spec: [M2](specs/M2-host-settings.md). |
| M3 | Web app (PWA): join by QR and name, play the same game as Telegram players, installable | UC-1 – UC-5 | Shipped 2026-10-13 (#34–#38), live at [a3spy.mazino2d.workers.dev](https://a3spy.mazino2d.workers.dev/); W1–W10 closed; mixed-table playtest passed 2026-10-13. Strategy change: dropped the "no separate app or website" non-goal and widened "DM only" to "private screen per player" (see [strategy](strategy.md)). Trade-off: a second client to keep in sync with every rule change. Spec: [M3](specs/M3-web-app.md). Implementation: [M3](../implementations/M3-web-app.md). |
| M4 | Optional reminder timers for discussion and voting (G5, [#13](https://github.com/mazino2d/a3spy/issues/13)) | UC-3 | Shipped 2026-10-14 (#43). Reminders only: the bot never opens or closes a vote (principle 3). Spec: [M4](specs/M4-timers.md). |
| M5 | Long-term stats: personal numbers and a group leaderboard (S2, [#19](https://github.com/mazino2d/a3spy/issues/19)) | UC-6 | Shipped 2026-10-14 (#44). Web guests and Telegram players are separate records; linking and profiles stay out. Spec: [M5](specs/M5-long-term-stats.md). |

## Now

| ID | Item | Serves | I | C | E | Score | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Next

| ID | Item | Serves | I | C | E | Score | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Later

| ID | Item | Serves | I | C | E | Score | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Rejected / parked

Ideas that were triaged and declined, kept so they are not re-litigated.

| ID | Idea | Decision | Reason | Date |
| --- | --- | --- | --- | --- |
| — | Group chat mode (bot in a Telegram group) | Rejected | Words would need DMs anyway; a group chat mixes game noise with the friends' chat. "Private screen per player" covers it. | 2026-10-13 |
| — | Remote play (describe and vote over chat or voice) | Rejected | Non-goal: the game is played out loud at the table. | 2026-10-13 |
| — | Native iOS/Android apps | Parked | The PWA covers install and full screen at no store cost. Revisit only if a needed feature is impossible on the web. | 2026-10-13 |
| — | Custom word lists typed in chat (legacy `/config`) | Rejected | It let anyone replace everyone's words; packs come by PR and are reviewed. | 2026-10-13 |
