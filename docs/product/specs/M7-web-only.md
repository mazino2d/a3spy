# M7 Web only

Status: in progress   ·   Serves: UC-1, UC-6, UC-9   ·   Roadmap: Now   ·   Implementation: [M7](../../implementations/M7-web-only.md)

## Problem

A3 Spy runs the same game on two clients. Every feature since M3 (settings, timers, stats,
voice) was built and tested twice, and Telegram keeps getting in the way: game screens become
chat messages mixed with everything else, buttons are limited to callbacks, and voice needs a
separate page and a login step. As the game grows, Telegram cannot show what the next features
need, and keeping it level with the web slows everything down.

The group already plays in the web app: it joins by link or QR, works for friends without
Telegram, and carries voice. From M7 the web app is the only place the game runs. The bot
stays as the front door: it tells newcomers what A3 Spy is, sends them to the web app, and
lets the owner announce what is new.

## Decisions (2026-10-17)

| Topic | Decision |
| --- | --- |
| Where the game runs | **Only the web app.** The bot no longer opens, joins or runs rooms. |
| Cutover | **Hard cutover in one deploy.** No period where both clients play. Games running on Telegram at that moment end without a result. |
| Old data | **Deleted at cutover**: every room, web guest session, room pointer and long-term stat. Everyone starts fresh on the web, with a new name prompt. |
| Long-term stats | Reset to zero. The Stats screen keeps working and counts from the cutover on. |
| What the bot does | (1) **Signpost**: `/start`, `/help` and any message get a short intro, the rules in a few lines and a **Chơi trên web** button. (2) **Old invite links** `t.me/a3spy_bot?start=<code>` answer with a button to that room on the web. (3) **Announcements** from the owner to everyone who has started the bot. |
| Announcement audience | Every Telegram user who started or messaged the bot. Users who block the bot are dropped. Before the cutover, the owner sends one announcement ("A3 Spy moves to the web") to everyone who played on Telegram, so that list is collected first and kept through the data deletion. It holds Telegram user ids only, no game data. |
| Who may announce | Only the owner's Telegram account (configured as a secret, not in the code). Each announcement shows a preview and is sent only after the owner confirms. |
| Voice for Telegram players | Removed with the rest of the Telegram game (M6 V4). Voice works in the web app as before. |
| Bot profile | Name, description and command menu say "play on the web": commands `/start` and `/help` only. |

## User stories

Story IDs use two new epic letters: `X` (moving the game to the web) and `B` (the bot as a
channel). Each becomes a GitHub issue in milestone M7.

| ID | Story | Priority |
| --- | --- | --- |
| B1 | As the owner, I send an announcement to everyone who has used the bot, after seeing a preview, so the group hears about the move and later updates. | Must |
| B2 | As a newcomer who opens the bot, I see in one message what A3 Spy is and a button that opens the web app. | Must |
| X1 | As a player, I play every game in the web app; the bot no longer starts or runs games. | Must |
| X2 | As a friend with an old Telegram invite link, I tap it and get a button to that room on the web. | Must |
| X3 | As the group, we start fresh: all rooms, sessions and stats from before the move are deleted. | Must |
| X4 | As a web player, the lobby shares only the web link and QR code; nothing points to Telegram to play. | Should |

## Acceptance criteria

### Announcements (B1)

- **AC1** Given a Telegram user who sends `/start` or any message to the bot, then they are on the announcement list, at most once.
- **AC2** Given the owner sends `/announce <text>`, then the owner sees a preview of exactly the message others will get, with **Gửi** and **Huỷ** buttons and the number of recipients; nothing is sent yet.
- **AC3** Given the owner taps **Gửi**, then every user on the list gets the message once, and the owner gets a summary "sent to N, failed M" when it is done.
- **AC4** Given a user who blocked the bot, when an announcement is sent, then the failure is counted and the user is removed from the list.
- **AC5** Given anyone but the owner sends `/announce`, then the bot answers as for any other message (B2) and sends nothing.
- **AC6** Given a preview older than one announcement (the owner sent `/announce` again), when its **Gửi** is tapped, then nothing is sent and the owner is told it is stale.

### The bot as a signpost (B2, X1, X2)

- **AC7** Given a user sends `/start`, `/help`, any old game command (`/newgame`, `/join`, `/leave`, `/score`, `/stats`, `/end`) or any text, then the bot answers with one message: what A3 Spy is in 1–2 lines, the rules in at most 4 lines, and a **Chơi trên web** button to the web app.
- **AC8** Given a user opens an old invite link `t.me/a3spy_bot?start=<code>`, then the bot answers with a **Vào phòng <code>** button to `<web app>/r/<code>`; if that room does not exist, the web app says so as it does today.
- **AC9** Given a tap on any button from an old game message (vote, start, settings, Xem từ…), then the bot answers the tap with "A3 Spy đã chuyển sang web" and changes nothing.
- **AC10** Given the bot's profile, then its description and command menu point to the web app and list only `/start` and `/help`.

### Fresh start (X3)

- **AC11** Given the cutover deploy, then no room, web session or stat from before it can be reached: old room links show "room not found", a returning web guest is asked for a name, and the leaderboard is empty.
- **AC12** Given the cutover, then the announcement list (AC1) is kept.

### Web lobby (X4)

- **AC13** Given a web lobby, then it shows the room's web link, QR code and Share button, and no Telegram invite link.

### Secrets

- **AC14** Given any bot message, then it never contains a word or a role (the bot no longer knows any game).

## Edge cases checklist

- Room: a Telegram game running at the cutover ends without a result; its players get the
  signpost on their next message or tap (AC7, AC9).
- Round: stale buttons from old game messages (AC9); stale announcement previews (AC6).
- Secrecy: AC14; announcements never include game data.
- Clients: web only after the cutover; Telegram users without the web app get a button to it.
- Announcements: empty list (preview says 0, **Gửi** does nothing); 30 recipients (all sent,
  within Telegram's rate limits); a long text (Telegram's 4096-character limit: the preview
  refuses it with a reason); HTML-sensitive characters are sent as plain text.
- ~~Player count~~ (no game in the bot).
- Copy: Vietnamese, playful and short; the intro reads in 3 seconds.

## Success check

- The week after the cutover, every game in the group is played in the web app, and nobody
  asks how to play on Telegram.
- The "moves to the web" announcement reaches every Telegram user who played in the last month.

## Out of scope

- Telegram Login or any account on the web; carrying stats or history over (decided: reset).
- Scheduled or automatic announcements; announcements to a Telegram group or channel.
- A Telegram Mini App.

## Open questions

- Announcement audience before the cutover (decision row, *proposed*): if declined, the list
  starts empty at cutover and fills as people message the bot.
