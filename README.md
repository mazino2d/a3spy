# A3 Spy

A Telegram bot that runs *Who is Spy* (Undercover rules) for friends playing in person. Everyone talks out loud; the bot deals secret words over DM, calls the speaking order, runs the vote, eliminates, reveals and keeps score.

Play it: [t.me/a3spy_bot](https://t.me/a3spy_bot)

## How a game goes

1. The host sends `/newgame` to the bot and shares the invite link.
2. Everyone taps the link to join; the lobby updates in each player's DM.
3. The host taps **Bắt đầu**. Each player privately gets a word (spies get a similar word and don't know they're spies; Mr. White gets none).
4. The bot announces the speaking order; people describe their word out loud.
5. The host taps **Mở vote**; everyone taps the player they suspect. The bot closes the vote, eliminates the top suspect and reveals their role. Ties get one revote.
6. An eliminated Mr. White may guess the civilians' word to win alone.
7. Rounds repeat until civilians catch every spy, or spies equal the civilians. The bot reveals every role and both words; **Chơi lại** deals a new game.

Commands: `/newgame`, `/join <code>`, `/leave`, `/score`, `/end` (host), `/help`. Full rules: [docs/rules.md](docs/rules.md).

## Docs

| Doc | What's in it |
| --- | --- |
| [PRD](.claude/skills/product-owner/PRD.md) | Problem, goals, rules, user stories, release plan |
| [docs/rules.md](docs/rules.md) | Exact rules the code and tests implement |
| [AGENTS.md](AGENTS.md) | Architecture, conventions and workflow for humans and AI agents |
| [Skills](.claude/skills/) | Role playbooks: `product-owner`, `software-engineer`, `software-tester`, `designer` |
| [Issues](https://github.com/mazino2d/a3spy/issues) | Backlog, one issue per user story |

## Architecture

TypeScript on **Cloudflare Workers** (free plan) with **grammY**. Telegram calls the Worker by webhook; each room is a **Durable Object** that holds the game state and sends the room's messages; a small Durable Object per player remembers which room they're in. Game rules are a pure state machine in `src/game`, tested without Telegram or Cloudflare.

```text
Telegram ──webhook──▶ Worker ──▶ RoomDO (per room) ──▶ src/game (rules)
                                   PlayerDO (per player)
```

## Development

Requires Node 24 (npm 11).

```bash
npm ci
npm run check   # lint + typecheck + tests
npm run dev     # local Worker; copy .dev.vars.example to .dev.vars and use a test bot
```

Add word pairs in `words/*.json` (pairs of similar words, one theme per file); tests validate them.

## Delivery

- `main` is protected: changes land through PRs, and the `ci-ok` check must pass.
- Merging to `main` deploys to Cloudflare and points the Telegram webhook at the Worker (`.github/workflows/cd.yml`).
- The bot's name, descriptions, `/` command menu and avatar are configured in `telegram/` and synced on merge (`.github/workflows/telegram-profile.yml`).
- Repo settings, the Cloudflare deploy token and secrets are managed as code in [everything-as-code](https://github.com/mazino2d/everything-as-code) (`terraform/github`, `terraform/cloudflare`).
