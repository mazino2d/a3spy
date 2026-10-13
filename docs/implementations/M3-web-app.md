# M3 Web app (PWA) — implementation plan

Status: in progress (P0 done, P1–P4 in review)   ·   Spec: [M3 Web app (PWA)](../product/specs/M3-web-app.md)   ·   Written 2026-10-13

How M3 gets built: the architecture, the phases (one PR each) and the decisions behind
them. The spec defines *what* must be true; this plan defines *how* and in what order.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Hosting | The same Worker serves the web app through **Workers Static Assets** (`assets` in `wrangler.jsonc`, SPA fallback, `run_worker_first` for `/api/*`, `/webhook`, `/healthz`) | Free and unmetered on the free plan, one deploy, one origin: no CORS, cookies just work. |
| Realtime | **WebSocket per web player to the RoomDO**, using the Durable Object Hibernation API (`ctx.acceptWebSocket`, `webSocketMessage`) | The RoomDO already serializes every command; it becomes the hub for both clients. Hibernation keeps an idle room from billing duration. Polling would cost requests and add latency. |
| Player IDs | Web players get a **negative** random integer ID (48 bits); Telegram IDs are positive | `engine.Player.id` stays a `number`, so the engine, stored rooms and every `Record<number, …>` need no migration. `id > 0` is the transport test. |
| Sessions | `PlayerDO "<id>"` stores a web player's name and the SHA-256 of a random 32-byte token; the browser holds the token in an `HttpOnly; Secure; SameSite=Lax` cookie | Reuses the existing per-player DO (it already holds the player's room pointer), needs no new secret, and a lost token is just a new guest. |
| Commands | The Telegram callback switch in `RoomDO.onCallback` becomes one `apply(playerId, command)` used by both clients; web commands carry the same `{ action, gameId, round, arg }` as `callback_data` | One code path for rules, phase checks and stale-action rejection (AGENTS hard rule 5) on both clients. |
| What a web client receives | A pure projection in `src/game/view.ts`: `viewFor(room, playerId)` (the room as that player may see it) and `publicEvents(events, playerId)` | Secrecy is enforced in pure, unit-tested code instead of in each screen. The client never receives another player's hand until the rules reveal it. |
| Telegram fan-out | `plan()` still produces Telegram ops for everyone; `RoomDO.execute` drops `send`/`edit` ops for web IDs and pushes views to sockets instead | Smallest change to working Telegram code; the Telegram renderer does not need to know about the web. |
| Frontend | **Preact + Vite + TypeScript** in `web/`, built to `web/dist`; JSX through Vite's built-in transform (no Babel preset) | ~4 KB runtime for café 4G, JSX and hooks without React's weight; Vite gives a dev server proxying to `wrangler dev`. The whole app is ~15 KB gzipped. |
| PWA | Hand-written `manifest.webmanifest` and a small service worker that precaches the built app shell and never caches `/api/*` | The spec says online only; a 40-line worker is easier to audit for "never cache a word" than a generated one. |
| Icons | Extend `scripts/render-avatar.ts` to render 192, 512 and maskable 512 PNGs from `telegram/avatar.svg` into `web/public/icons/` | One source of truth for the brand mark (designer skill). |
| QR code | `uqr` (zero dependencies) rendered to SVG in the client | No network call, works offline once loaded. |
| Strings | Web copy in `web/src/messages.ts`, Vietnamese; Telegram copy stays in `src/bot/messages.ts` | Each client owns its layout; AGENTS hard rule 6 is widened to "one messages file per client". |
| Duplicate names | `engine.join` appends a suffix (`Minh (2)`) when a display name is already in the room | Fixes AC19 for both clients in pure code; Telegram users with the same first name benefit too. |
| Tests | Unit: `view.ts` secrecy, the name suffix, protocol and route parsing. Integration: session, join and WebSocket flows in the workers runtime. Web screens: a headless-browser smoke run per PR, recorded in the PR. Manual: install and mixed-table playtest | Keeps the existing pyramid; WebSockets are supported by `@cloudflare/vitest-plugin`. Screens stay thin (all logic is in `view.ts` and the API), so DOM component tests would add a second test runner for little coverage. |

## Architecture

```text
Browser (PWA, web/)                         Telegram
  │ GET /, /r/<code>  → static assets          │ webhook
  │ POST /api/session, /api/rooms…             │
  │ GET  /api/rooms/<code>/ws (WebSocket)      │
  ▼                                            ▼
Worker (src/index.ts)
  ├─ /webhook       → grammY (src/bot)          ─┐
  ├─ /api/*         → src/web/api.ts             │  authenticate cookie via PlayerDO
  └─ everything else → static assets (web/dist)  │
                                                  ▼
RoomDO "<code>"                                 PlayerDO "<id>"
  state: engine.Room + Telegram message ids       room pointer
  apply(playerId, command)  ← both clients        + web: name, token hash
  commit → plan() → Telegram ops (id > 0)
         → viewFor/publicEvents → sockets (id < 0)
  │
  ▼
src/game (pure): engine, roles, words, view
```

Web protocol (JSON over the socket):

```text
client → server  { type: "command", action, gameId, round, arg? } | { type: "guess", text }
server → client  { type: "state", view } | { type: "events", events } | { type: "error", code }
```

On connect the RoomDO sends `state` immediately (reconnect, AC20). After every commit it
sends `events` then `state` to each connected web player. A second socket for the same
player replaces the first (edge case: two tabs).

## Phases

Each phase is one PR, ends green on `npm run check`, and leaves production working.

| Phase | Scope | Stories / ACs | Effort | Status |
| --- | --- | --- | --- | --- |
| P0 | Product docs, spec and this plan | — | 0.5 d | Done (#23) |
| P1 | Client-neutral room: `apply()` shared by both clients, Telegram ops filtered to `id > 0`, duplicate-name suffix, `src/game/view.ts` with secrecy unit tests. No visible change on Telegram except the name suffix. | AC9, AC19 | 1.5 d | In review |
| P2 | Web sessions and realtime API: `POST /api/session`, `GET /api/me`, `POST /api/rooms`, `POST /api/rooms/<code>/join` and `/leave`, WebSocket upgrade with hibernation, integration tests for join, vote and reconnect | AC4–AC6, AC16, AC20–AC22 (server side) | 2 d | In review |
| P3 | Web shell and PWA: `web/` (Vite + Preact), static assets in `wrangler.jsonc`, manifest, service worker, icons, CI and CD build steps; screens: name, home (create / join by code), lobby with QR and share | W1, W2, W9 · AC1–AC6, AC23, AC24 | 2.5 d | In review |
| P4 | Game screens: word card (tap to reveal, auto-hide), speaking order, vote, results, Mr. White guess, end and reveal, play again, end game, scoreboard, connection banner | W3–W6, W8, W10 · AC7–AC16, AC20, AC21, AC25 | 2.5 d | In review |
| P5 | Mixed tables: the web link in the Telegram lobby and the Telegram link in the web lobby, copy review with the designer skill | W7 · AC17, AC18 | 0.5 d | Planned |
| P6 | Release: mixed-table café playtest (≥ 2 web, ≥ 3 Telegram), install checks on iOS Safari and Android Chrome, README, `docs/rules.md` and AGENTS update, close milestone | Success check | 1 d | Planned |

Total ≈ 10.5 days, matching the roadmap's Effort of 10.

## Phase details

### P1 Client-neutral room

- `src/room/RoomDO.ts`: extract `apply(playerId, cmd)` from `onCallback`; `onCallback`
  wraps it with Telegram replies. `onText` (Mr. White's guess) goes through the same path.
- `execute()`: skip `send` and `edit` ops whose `to < 0`; keep `pointer` ops for everyone.
- `src/game/view.ts`: `viewFor(room, viewer)` returns lobby (players, waiting, host,
  settings), game (phase, round, order, alive, candidates, own hand, own vote, vote count,
  roles revealed so far, both words only once ended) and score. `publicEvents` drops
  `game_started.game` and `vote_cast.targetId` (who voted for whom stays hidden);
  `game_ended` keeps every hand because the reveal is public.
- Unit tests: for every role and phase, `viewFor` contains the viewer's word and no other
  player's word or role unless revealed; property check across seeds for 3–12 players.

### P2 Web sessions and realtime API

- `src/web/api.ts`: tiny router (no framework) for `/api/*`; JSON in, JSON out; every
  response `Cache-Control: no-store`.
- `PlayerDO`: `createGuest(name, tokenHash)`, `verify(tokenHash)`; IDs from
  `crypto.getRandomValues`.
- Socket auth: the Worker verifies the cookie with PlayerDO, then forwards the upgrade to
  the RoomDO with the player ID in an internal header the RoomDO trusts only from the
  Worker (the RoomDO is not publicly addressable).
- Rooms opened on the web need the bot's username for the Telegram invite link: it is the
  public `TELEGRAM_BOT_USERNAME` var in `wrangler.jsonc`.
- Close codes: 4000 left, 4001 room closed, 4002 seat taken over by a newer socket.
- Rate limits are out of scope (friends only); input lengths are capped (name 24, guess 64).
- Integration tests: create → join → start (Telegram host) → web vote → close → web
  receives `events` and `state`; reconnect returns the same `state`; two sockets for one
  player keep only the newest; a stale command returns `error: stale` and a fresh `state`.

### P3 Web shell and PWA

- `web/index.html`, `web/src/main.tsx`, `web/src/messages.ts`, `web/src/api.ts`
  (fetch + socket with backoff reconnect), `web/public/manifest.webmanifest`,
  `web/public/sw.js`.
- `package.json`: `dev:web` (Vite, proxy `/api` to `wrangler dev`), `build:web`; `check`
  builds the web app so type errors there fail CI.
- `.github/workflows/ci.yml`: add `web/**` to the `app` path filter; build web before the
  wrangler dry-run. `cd.yml`: build web before `wrangler deploy`.
- Routes: `/` home, `/r/<code>` join, everything else the SPA fallback.

### P4 Game screens

- One screen per phase, driven only by `view`: lobby → word → describing (order) → voting
  → result → (white guess) → ended. No client-side game logic beyond display.
- Word card: face down by default, reveal on tap, hide after 5 s; no word in `document.title`,
  history state or `localStorage`.
- Designer skill reviews layout, button labels and copy before merge.

### P5 Mixed tables

- `src/bot/render.ts` `lobbyPanel`: add the web room link (needs the web origin; derive from
  a `WEB_ORIGIN` var in `wrangler.jsonc`, not a secret).
- Web lobby shows the Telegram invite link next to the QR code.

## Risks

| Risk | Mitigation |
| --- | --- |
| Free-plan limits (100k requests/day, WebSocket messages count 20:1) | A 10-player session is a few thousand messages; log daily request counts during the playtest. |
| iOS Safari drops sockets when the phone locks | Reconnect on `visibilitychange` and send `state` on every connect (AC20). |
| A secret leaks through a projection bug | Secrecy lives only in `view.ts`, covered by property tests; the client has no other data source. |
| Two clients drift on behaviour | Both call `apply()`; integration tests run mixed rooms. |

## Infra

- No new secret and no new Cloudflare product beyond Static Assets.
- A custom domain, if chosen (spec open question), is a Terraform PR in
  `mazino2d/everything-as-code` (`terraform/cloudflare`), not configured here.
