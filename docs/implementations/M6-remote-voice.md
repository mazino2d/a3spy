# M6 Remote play with voice — implementation plan

Status: in progress   ·   Spec: [M6 Remote play with voice](../product/specs/M6-remote-voice.md)   ·   Written 2026-10-17

How M6 gets built: where audio flows, what the Worker and the RoomDO add, and the PRs in
order. The spec defines *what* is true; this plan records *how*.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Media routing | **Cloudflare Realtime SFU.** Each player has one `RTCPeerConnection` to Cloudflare: it pushes one audio track and pulls one track per other player. | A mesh of 10 players is 45 peer connections, each needing its own negotiation, NAT traversal and reconnect; it breaks first on Vietnamese 4G behind CGNAT. One connection per device to an anycast SFU connects faster (AC6), reconnects simply (AC18) and costs the phone one encoder. |
| Cost | SFU and TURN egress share Realtime's free allowance (1,000 GB/month). Worst case 10 players: 10 × 9 streams × ~18 MB/h ≈ 1.6 GB/h, so about 600 hours a month; the remote group uses ~30. | Strategy: free to run. Verified before P2 (see Risks). |
| The setting | `Settings.voice: boolean`, default `false`, changed by `configure { kind: "voice" }` through the existing M2 settings path; Telegram callback arg `-1`. Named `voice`, not `online`, because the web app already uses `online` for its connection state. | It is a host setting like timers: lobby only, kept for play again (AC1–AC5). The engine's existing `game_running` check gives AC3 for free. |
| Voice state | Not in the engine. The RoomDO keeps the roster under its own storage key `voice`: per seat `{ sessionId, track, muted, conn }`. Pure helpers in `src/voice/roster.ts`. | Voice is not game state: the game never waits for it (AC19), and `src/game` must stay deterministic. A pure roster still gets unit tests. |
| Signaling | Over the room's existing WebSocket: new `voice.*` client messages; the RoomDO calls the Realtime API and returns SDP. | The socket already authenticates the seat and survives hibernation; no second channel to secure. |
| Realtime API calls | Made only by the RoomDO, with `REALTIME_APP_ID` (var) and `REALTIME_APP_TOKEN` (secret). Clients never see the token or other players' session ids. | The app token can create sessions on our account; a client holding it could run up usage. Session ids stay server-side so nobody outside the room can pull a track (AC11). |
| Who may pull what | The RoomDO pulls a track into a session only if both seats are in the room and the room has voice on. | AC11: the room code alone gives nothing. |
| Talking indicator | Computed on each device from the received audio level (`RTCRtpReceiver.getSynchronizationSources()`), never sent through the server. | AC13's 1 s needs no server round trip and costs no requests. |
| Who drives pulls | The **device**: on every roster change it pulls the members it is not hearing yet, one exchange at a time, and stops audio of members who left. The RoomDO only checks and forwards. | Keeps the server stateless about SDP and avoids two renegotiations racing on one session. A device that rejoins gets a new track name (`key`), so others pull it again. | 
| Own storage key | The roster is not part of `Stored`. | `execute()` writes back a `Stored` it loaded before awaiting Telegram; a join or mute in between would be undone. |
| No microphone | The device still joins, with an empty send transceiver, and shows as muted. | AC12: a player who denies the microphone can listen; one code path for both. |
| Mute | Client sets `track.enabled = false` and sends `voice.mute`; the RoomDO stores it and broadcasts the roster. | Muting locally is instant and sends silence; the roster makes it visible to others (AC14). |
| Audio settings | `getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })`, Opus defaults. | Phones on speaker in separate rooms; echo cancellation does most of the work, the headphones tip the rest (AC16). |
| Telegram players | A **Vào voice** URL button to `/v/<code>#<token>`; the page exchanges the token for a voice-only seat cookie and opens a voice-only socket. Identity: decided by the spike in P4 between Telegram `login_url` (identity signed by Telegram) and our own HMAC token. | `login_url` proves who is opening the link; an HMAC link is a bearer token, so a forwarded link would work for someone else (AC10). The spike checks which one opens with a working microphone on iOS and Android. |
| Voice-only socket | A socket tagged `voice:<id>` receives only `voice` messages (roster with names), never `state`. | AC9 and AC23: the voice page must never receive a `RoomView`, which carries the player's word. |
| Telegram lists | Lobby and round messages show only the **Vào voice** button and one line "🎙 Phòng online", not live voice status. The voice page and web screens carry the live marks (AC13). | Live marks in Telegram would mean editing every player's messages on every mute and join: subrequests, and eyes on the phone (principle 1). Noted for the product owner in the P2 PR. |

## Architecture

```text
Browser (web player or voice page)                         Cloudflare
┌──────────────────────────────┐   WebSocket (existing)   ┌──────────┐   fetch    ┌─────────────────────┐
│ VoiceCall                    │◀────────────────────────▶│ RoomDO   │──────────▶│ Realtime SFU API    │
│  getUserMedia → 1 track      │  voice.join / pull /     │ voice    │ sessions/  │ rtc.live.cloudflare │
│  RTCPeerConnection ─────────────── audio (SRTP) ───────────────────────────────▶│ .com/v1/apps/<id>   │
│  N−1 remote tracks → <audio> │  answer / mute / leave   │ roster   │ tracks/new │                     │
│  level meter → "talking"     │◀── voice { roster } ─────│          │ renegotiate│                     │
└──────────────────────────────┘                          └──────────┘            └─────────────────────┘
```

### Protocol additions (`src/web/protocol.ts`)

```text
client → room   { type: "voice", op: "join",   offer: SDP }            push my track
                { type: "voice", op: "answer", answer: SDP }           after a renegotiation offer
                { type: "voice", op: "mute",   muted: boolean }
                { type: "voice", op: "leave" }
room → client   { type: "voice", roster: [{ id, name, muted, reconnecting }], voice: boolean }
                { type: "voiceSdp", sdp: SDP, kind: "answer" | "offer", tracks: [{ id, mid }] }
                { type: "voiceError", code: "voice_off" | "realtime_unavailable" | "bad_sdp" }
```

### Join sequence

1. Player taps **Vào voice** (the tap also unlocks audio playback, AC20).
2. Client gets the microphone, creates a `sendonly` transceiver, sends `voice.join` with the offer.
3. RoomDO: `sessions/new` with the offer → answer; `tracks/new` to publish track `p<id>`;
   stores `{ sessionId, track }`; replies `voiceSdp(answer)`; broadcasts the roster.
4. For every other seat in the call, RoomDO pulls their track into the new session (one
   batched `tracks/new`), and pulls the new track into each existing session; each gets a
   `voiceSdp(offer)` and answers with `voice.answer` → `renegotiate`.
5. Clients map `mid` → player id to attach audio and the level meter.

Subrequests: a join costs 2 + (number of seats in the call) Realtime calls inside one
invocation; 10 players is 12, under the free plan's 50.

### Leaving and drops

- `voice.leave`, leaving the room, the room closing, or turning `voice` off: the seat leaves
  the roster at once and every device stops that player's audio.
- **Room socket dropped** (tab in the background, network blip, reconnect): audio does not
  go through the socket, so the call keeps playing. The RoomDO marks the seat
  `reconnecting` (shown as ⏳). When the socket is back, the device sends
  `voice.resume { key }` with its own track name and gets the seat back with the same
  session and mute state. A seat not resumed within 30 s is swept by the room alarm, which
  it shares with the M4 timer and the idle close.
- **Media path failed** (`connectionState = failed`, e.g. Wi-Fi to 4G): the device drops its
  connection and joins again with a new session, keeping its mute state; other devices pull
  the new track because its key changed. A refused resume (seat already swept) does the same.
- **Reload**: the page loses its connection; the seat waits 30 s as reconnecting, and one tap
  on **Vào voice** joins again (browsers need the tap to play audio).

## Phases

Every phase leaves production working: voice exists only in rooms where the host turned
"Chơi online" on, and the toggle ships first.

| Phase | Scope | Stories · ACs | Effort | PR | Status |
| --- | --- | --- | --- | --- | --- |
| P1 | `Settings.online` in the engine, `configure online`, Telegram lobby toggle and "🎙 Phòng online" line, web settings toggle, load-time default for stored rooms | V1 · AC1, AC2, AC3, AC5 | 0.5 | #59 | Done |
| P2 | Realtime app and secrets (everything-as-code #230); `src/voice/realtime.ts` (API client) and `src/voice/roster.ts` (pure); RoomDO voice ops; web `VoiceCall` (join, mute, leave, roster marks on every player list, talking meter, microphone-denied line, headphones tip); turning voice off ends the call | V2, V3, V6 · AC4, AC6, AC7, AC11–AC17, AC22, AC23 | 2 | #60 | Done |
| P3 | Robustness: `reconnecting` mark, resume over a new socket, 30 s sweep, rejoin on a failed media path, seat taken over by a newer tab; talking mark threshold lowered to −40 dBov with a 600 ms hold | V5 · AC18–AC21 | 1 | #61 | In review |
| P4 | Spike `login_url` vs HMAC link on iOS and Android Telegram; `/v/<code>` voice page; voice-only socket; **Vào voice** button in lobby and round messages | V4 · AC8–AC10 | 1.5 | | Planned |

Total 5 days, as estimated on the roadmap.

## Tests

| Level | Where | Covers |
| --- | --- | --- |
| Unit | `test/unit/settings.test.ts` | `voice` default off, host-only, refused while running, kept on play again |
| Unit | `test/unit/voice.test.ts` | Roster: members carry names and flags only, voice off and leaving empty seats, who may pull whom, closed sockets; voice message parsing; Realtime client request shapes and errors against a mocked `fetch` |
| Integration | `test/integration/voice.test.ts` | Over a real RoomDO with the Realtime API mocked: join → answer and roster broadcast; offline room refuses; a seat outside the room cannot join; voice socket never receives `state` (AC9, AC23); voice off ends the call |
| Manual | Checklist in each PR | Real devices: Android Chrome, iOS Safari, laptop; 4G + home Wi-Fi; join time (AC6), delay (AC17), drop and recover (AC18), Telegram button (P4) |

WebRTC itself cannot run inside workerd tests, so AC6, AC17 and AC18 are verified manually
and timed in the PR.

## Risks

| Risk | Mitigation |
| --- | --- |
| Realtime needs a payment method, or bills past the free allowance instead of stopping | Check before P2. If billing can run, add a Cloudflare billing notification at $1 and a usage note in the PR; if a card is required and the owner declines, stop and raise it with the product owner (strategy: free to run). |
| iOS pauses the browser call when the player switches to Telegram or locks the screen | Spec's default: accept for M6, recommend iPhone players use the web app. Measured in the first remote evening; P3's rejoin makes coming back one tap. |
| Telegram opens links in an in-app browser where the microphone may not work | P4's spike tests both button kinds on iOS and Android before building the page. |
| A network that blocks UDP cannot reach the SFU | Deferred: no TURN in P3. Home Wi-Fi and 4G pass UDP; add a Realtime TURN app (everything-as-code) only if a player cannot connect. |
| Echo when someone plays on speaker | Browser echo cancellation, the headphones tip, and each player's own mute. |
| Realtime API changes | All calls in one module (`src/voice/realtime.ts`) behind small typed functions. |
| A forwarded HMAC link lets someone else talk as that seat | Prefer `login_url` if the spike passes; otherwise the link only goes to the player's DM, the call shows the seat's name, and the latest device takes the seat. Raised with the product owner against AC10 if HMAC is chosen. |

## Infra (`everything-as-code`)

- Create the Realtime SFU app (and a TURN key for P3) in `terraform/cloudflare`, if the
  provider supports them; otherwise in the dashboard, recorded in that repo's README.
- Add GitHub secret `REALTIME_APP_TOKEN` (and `REALTIME_TURN_TOKEN` for P3); `cd.yml` pushes
  them as Worker secrets like the Telegram ones. `REALTIME_APP_ID` is a plain var in
  `wrangler.jsonc`.
- The Cloudflare deploy token needs no new permission: the Worker calls the Realtime API
  with the app token at runtime.
- P4 with `login_url`: set the bot's domain with BotFather `/setdomain` to the Worker host.
