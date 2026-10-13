# AGENTS.md

Guidance for AI agents (Claude Code, Codex, …) and humans working in this repo.

## What this is

A3 Spy is a Telegram bot that acts as the **game master** for *Who is Spy* (Undercover rules) while a group of friends plays **in person** at a café. People describe and argue out loud; the bot only deals secret words, calls the speaking order, runs the vote, eliminates, reveals and keeps score.

- Audience: one friend group, < 30 users, Vietnamese UI.
- Product spec (source of truth): [PRD — A3 Spy Revamp Gameplay](https://claude.ai/code/artifact/b93c4b7f-b4e8-4628-846a-d2a864feb420)
- Game rules for code and tests: [docs/rules.md](docs/rules.md) (kept in sync with the PRD)
- Backlog: GitHub Issues, one issue per user story (`L1`, `G2`, …).

## Roles and skills

Pick the skill that matches the task before starting:

| Skill | Use when |
|-------|----------|
| [`product-owner`](.claude/skills/product-owner/SKILL.md) | Writing or changing stories, acceptance criteria, rules, priorities, release scope |
| [`software-engineer`](.claude/skills/software-engineer/SKILL.md) | Implementing a story, refactoring, fixing a bug, touching CI/CD |
| [`software-tester`](.claude/skills/software-tester/SKILL.md) | Writing tests from acceptance criteria, reviewing coverage, playtesting, filing bugs |

## Stack

TypeScript on **Cloudflare Workers** (free plan), **grammY** for the Telegram Bot API, **Durable Objects** (SQLite-backed) for state, **Vitest** + `@cloudflare/vitest-plugin` for tests, **Biome** for lint/format. Telegram talks to the Worker by **webhook**; there is no long-running process.

```
Telegram ──webhook──▶ Worker (src/index.ts)
                       │  verify X-Telegram-Bot-Api-Secret-Token
                       ▼
                  grammY handlers (src/bot)
                       │
           ┌───────────┴────────────┐
           ▼                        ▼
   RoomDO "room:<code>"      PlayerDO "player:<telegram id>"
   room + game state,        which room the player is in
   alarms for timers         (one room per player)
           │
           ▼
   src/game — pure rules: deal, turn order, vote tally, win check
```

## Layout

```
src/
  index.ts        Worker entry: webhook auth, builds the bot, exports DOs
  bot/            grammY handlers, inline keyboards, callback routing
  bot/messages.ts Every user-facing string (Vietnamese) lives here
  game/           Pure game logic. No grammY, no Cloudflare imports.
  room/           RoomDO: persists a room, applies game commands, broadcasts
  player/         PlayerDO: player → current room
words/            Word-pair packs (JSON), one file per theme
docs/rules.md     Canonical rules for code and tests
test/unit/        Pure tests for src/game
test/integration/ Worker + DO tests in the workers runtime
```

## Commands

```bash
npm ci                 # install
npm run dev            # wrangler dev (local Worker + DOs)
npm test               # vitest (unit + integration)
npm run lint           # biome check
npm run typecheck      # tsc --noEmit
npm run check          # lint + typecheck + test — run before every PR
npx wrangler deploy --dry-run   # validates bundle + bindings
```

Node 24 (see `.nvmrc`); npm 11 respects `allowScripts` in `package.json`.

## Hard rules

1. **`src/game` stays pure.** Deterministic functions over plain data; randomness is injected (`rng` parameter) so tests are reproducible. Telegram and storage code call into it, never the reverse.
2. **All state lives in Durable Objects.** No module-level mutable state in the Worker; isolates are recycled at any time.
3. **Secrets never in code or git.** Bot token and webhook secret come from `env`. The legacy bot leaked its token in this public repo; do not repeat that.
4. **Words and roles are secret.** Send them only to the owner's DM or a `show_alert` popup. Never log them, never put them in `callback_data`.
5. **Every button press is answered** (`answerCallbackQuery`) and checked against the current phase/round; stale buttons from an earlier round are ignored.
6. **User-facing text is Vietnamese** and lives in `src/bot/messages.ts`.
7. **Infra is not configured here.** Branch protection, repo settings, the Cloudflare deploy token and GitHub secrets are managed in `mazino2d/everything-as-code` (`terraform/github`, `terraform/cloudflare`). Change them there by PR.

## Workflow

- Never push to `main`. Branch → PR → CI → squash merge. Merging deploys to production automatically.
- One story (or one bug) per PR; the PR body says `Closes #<issue>` and lists the acceptance criteria covered.
- Commit messages: Conventional Commits (`feat(game): …`, `fix(bot): …`, `test: …`, `ci: …`, `docs: …`).
- The only required check is **`ci-ok`**; it aggregates the path-filtered jobs, so a docs-only PR still gets a green check.

## Definition of Done

- Every acceptance criterion of the story has an automated test, or a line in the PR saying why it is manual-only.
- `npm run check` passes locally; CI is green.
- `docs/rules.md` and the PRD updated if behaviour or rules changed.
- No new strings outside `src/bot/messages.ts`; no secrets or words in logs.
