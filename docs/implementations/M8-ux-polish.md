# M8 UX polish — implementation plan

Status: in progress   ·   Spec: [M8 UX polish](../product/specs/M8-ux-polish.md)   ·   Written 2026-10-18

Mostly web-only changes in `web/`; one engine default and one rule line change.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Online default | `DEFAULT_SETTINGS.voice = true`; stored rooms keep their value. | One line in the engine; the settings path already carries it. |
| Pinned Start | A `position: sticky; bottom: 0` footer with the page's own background, and bottom padding on the settings so nothing hides behind it. | No layout library; works in iOS Safari and as an installed PWA. |
| QR fold | `<details>` around the QR code, `open` when voice is off. | Native, accessible, no state to keep. |
| Share image | Drawn on a `<canvas>` (1080×1350) from the final `RoomView`, with the page's fonts once `document.fonts.ready`; `canvas.toBlob` → `navigator.share({ files })` when `navigator.canShare({ files })`, else an `<a download>`. | No server, no new dependency; uses only what the ended game already shows (AC15). |
| End reason | Derived on the client from `view.game.winner` and the final events: `civilians`, `spies`, `white` (a correct guess), or `null` (ended early). | The view already carries the winner; no protocol change. |
| Rules page | Route `/luat` in the SPA, reachable without a session; `index.html` meta description covers link previews. | The Worker already serves the SPA for unknown paths; one screen component. |
| Body font | `@fontsource/ibm-plex-sans` (Vietnamese subset, 400/600) as a new dependency. | Self-hosted like the other fonts (designer skill). |

## Phases

| Phase | Scope | Stories · ACs | Effort | PR | Status |
| --- | --- | --- | --- | --- | --- |
| P1 | Online default; lobby share-first and QR fold; pinned Start; one-line voice bar and tip timeout; marks and icons; grouped settings with one toggle style | U1–U5 · AC1–AC10 | 1 | #86 | In review |
| P2 | Personal result and reason; clearer reveal; share image | U6, U7 · AC11–AC15 | 1 | | Planned |
| P3 | Rules page `/luat` and ❓ entries; Home hierarchy and code auto-join; loading skeleton; Plex Sans body | U8–U11 · AC16–AC21 | 1 | | Planned |

## Tests

| Level | Covers |
| --- | --- |
| Unit | End reason from a view; share-image layout data (players, roles, viewer) built from a view and containing nothing a player could not see; route parsing for `/luat` |
| Integration | New room has voice on; old rooms keep their value |
| Browser | Headless run at 390×844 per PR with screenshots: Start visible without scrolling, voice bar height, QR folded online, result headline, share image generated, `/luat` without a session |
