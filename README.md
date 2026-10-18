# A3 Spy

A game master for *Who is Spy* (Undercover rules) for friends, apart on the room's voice call or around one café table. Everyone talks freely; A3 Spy deals secret words to each phone, suggests who opens, runs the vote, eliminates, reveals, keeps score and makes a result image to share.

**Play:** [a3spy.mazino2d.workers.dev](https://a3spy.mazino2d.workers.dev/), in any phone browser, nothing to install (add it to the home screen to open it like an app). New to the game? Send friends the one-screen rules: [/luat](https://a3spy.mazino2d.workers.dev/luat).

The game runs only in the browser. The Telegram bot [@a3spy_bot](https://t.me/a3spy_bot) is not a way to play: it links to the web app and posts update announcements ([M7](docs/product/specs/M7-web-only.md)).

## How a game goes

1. The host taps **Mở phòng mới** and shares the room link or QR code.
2. Everyone opens the link and types a name; the lobby updates live on every phone.
3. The host taps **Bắt đầu**. Each player privately gets a word (spies get a similar word and don't know they're spies; Mr. White gets none).
4. Every phone shows the speaking order; people describe their word out loud.
5. The host taps **Mở vote**; everyone taps the player they suspect. The vote closes, the top suspect is eliminated and their role revealed. Ties get one revote.
6. An eliminated Mr. White may guess the civilians' word to win alone.
7. Rounds repeat until civilians catch every spy, or spies equal the civilians. Every role and both words are revealed; **Chơi lại** deals a new game.

Playing apart? The host turns on **Chơi online** and everyone taps **Vào voice**. Full rules: [docs/rules.md](docs/rules.md).

## Docs

| Doc | What's in it |
| --- | --- |
| [Product docs](docs/product/index.md) | Strategy, principles, use cases, roadmap, milestone specs |
| [Implementation plans](docs/implementations/) | How large milestones get built, phase by phase |
| [docs/rules.md](docs/rules.md) | Exact rules the code and tests implement |
| [AGENTS.md](AGENTS.md) | Architecture, conventions and workflow for humans and AI agents |
| [Skills](.claude/skills/) | Role playbooks: `product-owner`, `software-engineer`, `software-tester`, `designer` |
| [Issues](https://github.com/mazino2d/a3spy/issues) | Backlog, one issue per user story, grouped by milestone |

## Architecture

TypeScript on **Cloudflare Workers** (free plan). The Worker serves the web app (Preact, in `web/`) as static assets and its API. Each room is a **Durable Object** that holds the game state and pushes it to players over WebSockets; voice goes through Cloudflare Realtime SFU, signalled over the same socket. A small Durable Object per web guest holds their session and current room. Game rules are a pure state machine in `src/game`, tested without Cloudflare. Telegram calls the Worker by webhook only for the bot (**grammY**): a signpost and the owner's announcements.

```text
Browser ──/api, ws──▶ Worker ──▶ GameRoomDO (per room) ──▶ src/game (rules)
        ◀─web/dist─────┘   │      GuestDO (per guest) · LeaderboardDO
Telegram ──webhook─────────┘──▶ bot: signpost, /announce ──▶ AudienceDO
```

## Development

Requires Node 24 (npm 11).

```bash
npm ci
npm run check   # lint + typecheck + tests
npm run dev     # local Worker + web app; copy .dev.vars.example to .dev.vars (a test bot token only matters for bot work)
npm run dev:web # web app with hot reload, talking to `npm run dev`
```

Add word pairs in `words/*.json` (pairs of similar words, one theme per file); tests validate them.

## Delivery

- `main` is protected: changes land through PRs, and the `ci / gate` check must pass.
- Merging to `main` deploys to Cloudflare and points the Telegram webhook at the Worker (`.github/workflows/cd.yml`).
- The bot's name, descriptions, `/start` and `/help` menu and avatar are configured in `telegram/` and synced on merge (`.github/workflows/telegram-profile.yml`).
- Repo settings, the Cloudflare deploy token and secrets are managed as code in [everything-as-code](https://github.com/mazino2d/everything-as-code) (`terraform/github`, `terraform/cloudflare`).
