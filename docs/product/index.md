# A3 Spy product docs

How A3 Spy decides what to build and why. These pages are the source of truth for product
decisions and are maintained alongside the code by the `product-owner` skill.

## Strategy

- [Product strategy](strategy.md): vision, problem, personas, objective, North Star bars,
  non-negotiables, non-goals and quality requirements.
- [Design principles](principles.md): ordered principles and what each one costs.
- [Use cases](use-cases.md): core and supporting use cases with measurable success
  criteria.
- [Roadmap](roadmap.md): milestones and the backlog, scored with RICE-lite.
- [Word packs](word-packs.md): what makes a good pair, and the themes.
- [Game rules](../rules.md): the exact rules the code and tests implement.

## Milestones

Each milestone has a spec that records its decisions and stories. Stories are GitHub
issues in the matching milestone.

| Milestone | Status | Summary |
| --- | --- | --- |
| [M1 Telegram game master](specs/M1-telegram-game-master.md) | Shipped | The bot runs the whole game over DM: rooms, dealing, rounds, vote, reveal, play again, score. [Implementation](../implementations/M1-telegram-game-master.md). |
| [M2 Host settings and playtest fixes](specs/M2-host-settings.md) | Planned | The host picks themes, spy count and Mr. White; fixes from the first café session. |
| [M3 Web app (PWA)](specs/M3-web-app.md) | In progress | Anyone joins by QR and a name and plays the same game as Telegram players; installable. Live at [a3spy.mazino2d.workers.dev](https://a3spy.mazino2d.workers.dev/); waiting for the café playtest. [Implementation](../implementations/M3-web-app.md). |
