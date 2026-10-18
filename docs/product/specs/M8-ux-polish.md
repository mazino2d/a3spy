# M8 UX polish

Status: shipped 2026-10-18   ·   Serves: UC-1, UC-3, UC-4, UC-7, UC-9   ·   Roadmap: Shipped   ·   Implementation: [M8](../../implementations/M8-ux-polish.md)

## Problem

A UI review on 2026-10-18 (a real 3-player game on production, at phone size, with voice)
found that the app looks and plays well, but players lose their bearings at the moments
that matter: the host scrolls ~1,300 px past a huge QR code and the settings to reach
**Bắt đầu**; the voice bar takes a quarter of the screen; 🗣 means two things; a game can
end with no word on why, and nobody sees whether *they* won; and since the game left
Telegram, there is no place to read the rules, so inviting a friend means explaining it.

Most evenings are now remote, so the app should start from that: online by default, a link
to share before a QR code to scan, and a result worth posting.

## Decisions (2026-10-18, by the owner)

| Topic | Decision |
| --- | --- |
| Turns | **No turn-taking.** Everyone talks freely, as at a café; no current-speaker pointer, no "next" button. The speaking order stays as a suggestion of who opens each round (decided 2026-10-18). |
| Default setting | **"Chơi online" is on in a new room.** The café table is the occasional case; the host turns it off. Changes M6 AC1. |
| Lobby | Share first: room code, **Chia sẻ link** and **Copy mã** at the top; the QR code is folded behind "Hiện mã QR" (open by default only when "Chơi online" is off). The host's **Bắt đầu** is pinned to the bottom of the screen. |
| Voice bar | One line: `🎙 N · [mute] [Rời]`. The headphones tip shows once per device and hides after 8 s or a tap. |
| Marks | 🗣 means only "talking now". The speaking-order heading uses 📋. No voice marks on vote buttons. One emoji per meaning across screens (e.g. 🏅 for scores and stats). |
| Settings | One toggle style for every on/off setting; grouped as **Vai** (spies, Mr. White, auto), **Nhịp chơi** (timers), **Chơi online**, **Chủ đề**. |
| End of game | A personal headline (**Bạn thắng!** / **Bạn thua…**, with your role), one line on **why** the game ended, and a clear reveal (❌ for eliminated, "(bạn)" on your row). |
| Sharing the result | **Chia sẻ kết quả** makes a result image on the phone (no server) and opens the share sheet; where sharing files is not supported, it downloads the image. |
| Rules | A public page **/luat**: the rules in one screen, with **Chơi ngay** to the web app; meant to be sent to friends. A **❓ Luật** entry on Home, Lobby and Game opens it. |
| Home | Hierarchy: **Mở phòng mới** first, code entry second (auto-uppercase, joins at 4 characters), Stats and Rules as small links. |
| Loading | "Đang kết nối…" shows the logo and a skeleton of the screen instead of a blank page. |
| Body font | Body text in IBM Plex Sans; IBM Plex Mono stays for typed elements (word card, labels, codes); Oswald for headings. Self-hosted as today. |

## User stories

Story IDs use the new epic letter `U` (UX). Each becomes a GitHub issue in milestone M8.

| ID | Story | Priority |
| --- | --- | --- |
| U1 | As a host, my room is online by default and I share it with a link or the code before anything else. | Must |
| U2 | As a host, I start the game without scrolling. | Must |
| U3 | As a player in a call, the voice bar takes one line. | Must |
| U4 | As a player, every mark and icon means one thing. | Must |
| U5 | As a host, the settings look alike and are grouped. | Should |
| U6 | As a player, when a game ends I see whether I won, my role, and why it ended. | Must |
| U7 | As a player, I share the game's result as an image with one tap. | Must |
| U8 | As a player inviting friends, I send a rules page that explains the game in one screen and opens the app. | Must |
| U9 | As a returning player, Home shows what to do first and joins a code without extra taps. | Should |
| U10 | As a player, opening a room never shows a blank page. | Could |
| U11 | As a player, long Vietnamese sentences are easy to read. | Could |

## Acceptance criteria

### Lobby (U1, U2)

- **AC1** Given a new room, then "Chơi online" is on and the voice bar is shown; the host can turn it off as before.
- **AC2** Given a lobby, then the room code, **Chia sẻ link** and **Copy mã** are the first things under the title; **Copy mã** copies the 4-character code and says so for 2 s.
- **AC3** Given "Chơi online" is on, then the QR code is folded behind **Hiện mã QR**; given it is off, then the QR code is shown open.
- **AC4** Given the host's lobby at 390×844, then **Bắt đầu** (and its hint) stays visible at the bottom while the page scrolls, and never covers the last setting.

### Voice and marks (U3, U4)

- **AC5** Given a player in the call, then the voice bar is one line no taller than 56 px: count, mute toggle, leave.
- **AC6** Given the headphones tip, then it shows only on the first call on a device and hides after 8 s or a tap.
- **AC7** Given any screen, then 🗣 appears only as the "talking now" mark; the speaking-order heading uses 📋.
- **AC8** Given the vote screen, then vote buttons show names only, no voice marks.
- **AC9** Given Home and the game header, then scores and stats use the same icon (🏅).

### Settings (U5)

- **AC10** Given the host's settings, then Mr. White, Chơi online and every other on/off setting use the same toggle; settings are grouped under Vai, Nhịp chơi, Chơi online and Chủ đề.

### End of game (U6, U7)

- **AC11** Given a game ends with a winner, then each player sees **Bạn thắng!** or **Bạn thua…** with their own role; a player not dealt in (waiting list) sees the winning side only.
- **AC12** Given a game ends, then one line says why: civilians caught every spy and Mr. White; spies reached the number of civilians; Mr. White guessed the word; or the host ended it early (no winner).
- **AC13** Given the reveal, then eliminated players are marked ❌, and the viewer's row says "(bạn)".
- **AC14** Given a game that ended with a winner, when a player taps **Chia sẻ kết quả**, then a portrait image (1080×1350) is made on the phone with: the winning side, both words, every player and role, the viewer's own result, and the app's link; it opens the share sheet with that image, or downloads it where sharing files is not supported.
- **AC15** Given the image, then it contains nothing that was not already on every player's screen at the end of the game.

### Rules (U8)

- **AC16** Given anyone opens `/luat`, then without a name or a room they see the rules in one phone screen (roles, a round, how to win, voice in one line) and a **Chơi ngay** button to the app; the page has its own title and link preview text.
- **AC17** Given Home, Lobby or Game, then a **❓ Luật** entry opens the rules; from a room, coming back returns to the same room state.
- **AC18** Given the rules page, then **Chia sẻ** shares its link.

### Home, loading, type (U9, U10, U11)

- **AC19** Given Home, then **Mở phòng mới** is the only primary button; the code field upper-cases as typed and joins as soon as 4 valid characters are entered; Stats and Rules are text links.
- **AC20** Given a room is loading, then the logo and a skeleton of the room screen show until the first state arrives.
- **AC21** Given body text, then it is set in IBM Plex Sans (self-hosted, Vietnamese subset); the word card, codes and labels stay in Plex Mono.

## Edge cases checklist

- Room: online by default also for "Chơi lại" (settings are kept) and for rooms opened before M8 (they keep their value).
- Round: ~~stale actions~~ (no new actions besides share and copy, which change no state).
- Secrecy: AC15; the share image is only offered once words are public (game ended); a game ended early with no winner offers no share.
- Clients: Web Share with files (Android Chrome, iOS Safari) and without (desktop: download); clipboard blocked: show the code to copy by hand.
- Player count: 3 (game can end after one vote: AC12 explains it); 12 names on the share image fit (two columns past 8).
- Copy: Vietnamese, playful; long names and words wrap on the image without overflow.

## Success check

- At the next remote evening nobody asks "bắt đầu ở đâu" or "ai thắng".
- Within two weeks, at least one result image is posted in the group chat, and the rules link is sent to someone new.

## Out of scope

- Turn pointer or speaking timer (decided 2026-10-18).
- Server-made images or result links; animations; dark mode (one light theme by design).

## Open questions

None.
