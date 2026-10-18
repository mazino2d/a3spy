# A3 Spy — AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, …) and human contributors working in
this repo.

A3 Spy is the **game master** for *Who is Spy* (Undercover rules) while a group of friends
plays at one café table or apart on the room's voice call. People describe and argue out
loud; A3 Spy deals secret words, calls the speaking order, runs the vote, eliminates, reveals
and keeps score. The game runs only in the web app (PWA) at
https://a3spy.mazino2d.workers.dev/; the Telegram bot is a signpost and an announcement
channel ([M7](docs/product/specs/M7-web-only.md)). Audience: one friend group, < 30 users.
Product context: [docs/product/](docs/product/index.md).

## Language policy

**Write everything in English**: code, comments, docs, issues, commit messages and PR
descriptions. Only what players see is Vietnamese, and it lives in `web/src/messages.ts`
(web app) or `src/bot/messages.ts` (the bot's signpost and announcements).

## Critical rules

1. **`src/game` stays pure.** Deterministic functions over plain data; randomness is
   injected (`rng` parameter) so tests are reproducible. Web and storage code call
   into it, never the reverse.
2. **All state lives in Durable Objects.** No module-level mutable state in the Worker;
   isolates are recycled at any time.
3. **Secrets never in code or git.** Bot token and webhook secret come from `env`. The
   legacy bot leaked its token in this public repo; do not repeat that.
4. **Words and roles are secret.** Only `src/game/view.ts` decides what reaches a player's
   screen. Never log them, never put them in URLs, broadcasts or anything the bot sends.
5. **Every command is checked** against the current phase and round; stale actions from an
   earlier round are refused and the client gets a fresh state. Every bot button press is
   answered (`answerCallbackQuery`).
6. **User-facing text is Vietnamese** and lives in `web/src/messages.ts` (web app) and
   `src/bot/messages.ts` (the bot).
7. **Infra is not configured here.** Branch protection, repo settings, the Cloudflare
   deploy token and GitHub secrets are managed in `mazino2d/everything-as-code`
   (`terraform/github`, `terraform/cloudflare`). Change them there by PR.

## Commands

```bash
npm ci                          # install (Node 24, see .nvmrc; npm 11 respects allowScripts)
npm run dev                     # wrangler dev (local Worker + DOs + built web app); secrets in .dev.vars
npm run dev:web                 # Vite dev server for web/, proxies /api to `npm run dev`
npm run build:web               # build web/ → web/dist (tests and wrangler need it)
npm run check                   # lint + typecheck + build web + test — what CI runs; run before every PR
npm test                        # vitest (unit + integration)
npx wrangler deploy --dry-run   # validates bundle + bindings after config changes
npm run avatar                  # render telegram/avatar.svg → avatar.jpg + web icons
TELEGRAM_BOT_TOKEN=… npm run telegram:profile -- --dry-run   # diff the bot profile
```

Commits and PR titles use Conventional Commits (`feat(game): …`, `fix(bot): …`).

## Skills

Detailed workflows live in [.claude/skills/](.claude/skills/), one folder per role with a
`SKILL.md` entry point. Claude Code loads them automatically; other agents should read
the matching `SKILL.md` before starting the task.

| Task | Skill |
| --- | --- |
| Triage ideas and playtest feedback, write specs and stories, change rules, update the roadmap | [`product-owner`](.claude/skills/product-owner/SKILL.md) — strategy, specs and roadmap in `docs/product/` |
| Implement a story, refactor, fix a bug, touch CI/CD; write implementation plans | [`software-engineer`](.claude/skills/software-engineer/SKILL.md) — plans in `docs/implementations/` |
| Tests from acceptance criteria, coverage review, playtests, bug reports | [`software-tester`](.claude/skills/software-tester/SKILL.md) |
| Avatar, bot profile and command menu, message layout, button labels, UX copy | [`designer`](.claude/skills/designer/SKILL.md) |

## Docs

| Doc | Holds | Owner |
| --- | --- | --- |
| [docs/product/](docs/product/index.md) | Strategy, principles, use cases, roadmap, word packs | product-owner |
| [docs/product/specs/](docs/product/specs/) | One spec per milestone (`M<n>-<slug>.md`): decisions, stories, acceptance criteria | product-owner |
| [docs/implementations/](docs/implementations/) | One plan per large milestone: architecture, phases, technical decisions | software-engineer |
| [docs/rules.md](docs/rules.md) | Exact game rules code and tests implement | product-owner |
| GitHub Issues + Milestones | One issue per story (`L1`, `G2`, `W3`…), grouped by milestone | product-owner |

## Architecture

TypeScript on **Cloudflare Workers** (free plan), **Durable Objects** (SQLite-backed) for
state, **Preact** + **Vite** for the web app, **grammY** for the bot, **Vitest** +
`@cloudflare/vitest-plugin` for tests, **Biome** for lint and format. There is no
long-running process.

```text
Browser ──/api/*, WebSocket──▶ Worker (src/index.ts) ──▶ GameRoomDO "<code>"
        ◀── web/dist ─────────┘   │                       room + game state, voice roster,
                                  │                       one alarm (timer, voice sweep, idle close)
                                  │                           │
                                  │                           ▼
                                  │                       src/game — pure rules
                                  ├──▶ GuestDO "<guest id>"  name, session hash, current room
                                  └──▶ LeaderboardDO "group" long-term stats (no words)
Telegram ──webhook──▶ Worker ──▶ bot (src/bot): signpost, old invite links, /announce
                                  └──▶ AudienceDO "bot"      Telegram ids for announcements
```

Voice goes through Cloudflare Realtime SFU; only `GameRoomDO` calls its API, and the room's
WebSocket carries the signaling ([M6 plan](docs/implementations/M6-remote-voice.md)).

## Layout

```text
src/
  index.ts        Worker entry: webhook auth, web API routing, exports DOs
  bot/            grammY bot: signpost, old invite links, /announce; bot strings (Vietnamese)
  audience/       AudienceDO "bot": who gets announcements, batched sending
  game/           Pure game logic. No grammY, no Cloudflare imports.
  room/           GameRoomDO: persists a room, applies commands, pushes state, voice signaling
  player/         GuestDO: web guest name, token hash, current room
  stats/          LeaderboardDO "group": long-term stats per player (no words)
  voice/          Voice roster (pure) and the Realtime SFU API client
  web/            Web API (/api/*), guest sessions, socket protocol shared with the client
words/            Word-pair packs (JSON), one file per theme
web/              Web app (PWA): Preact + Vite, served by the Worker as static assets
  src/messages.ts Every web string (Vietnamese)
  public/         manifest, service worker (never caches /api), icons rendered from the avatar
telegram/         Bot profile as code: profile.json, avatar.svg → avatar.jpg
scripts/          Node scripts: render the avatar and web icons, sync the profile to Telegram
docs/             Product docs, implementation plans, game rules
test/unit/        Pure tests for src/game, the voice roster and protocol parsing
test/integration/ Worker + DO tests in the workers runtime
```

## Workflow

- Never push to `main`. Branch → PR → CI → squash merge. Merging deploys to production
  automatically.
- One story (or one bug) per PR; a few tightly coupled stories of one milestone, or one
  phase of an implementation plan, may share a PR. The PR body says `Closes #<issue>` for
  each and lists the acceptance criteria covered.
- The only required check is **`ci / gate`**; it aggregates the path-filtered jobs, so a
  docs-only PR still gets a green check.

## Definition of Done

- Every acceptance criterion of the story has an automated test, or a line in the PR
  saying why it is manual-only.
- `npm run check` passes locally; CI is green.
- `docs/rules.md` and the milestone spec updated if behaviour or rules changed; the
  implementation plan's phase table updated if the work follows one.
- No new strings outside the messages files; no secrets or words in logs.
