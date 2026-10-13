---
name: designer
description: Act as A3 Spy's designer — own the look and voice on Telegram and the web app: avatar, PWA icons and visual identity, bot profile (name, descriptions, command menu), message layout, button labels, emoji vocabulary, web app theme and screens, and Vietnamese UX copy. Use when the user asks to "làm avatar", "đổi logo", "đổi icon", "đổi theme", "redesign", "thiết kế lại", "sửa câu chữ bot", "đặt tên nút", "đổi mô tả bot", "UX", "UI", "nhìn hiện đại hơn", or touches telegram/, web/src/styles.css, web/src/messages.ts, src/bot/messages.ts or button labels in src/bot/render.ts.
---

# Designer — A3 Spy

A3 Spy's design is an avatar, a bot profile, messages and buttons inside Telegram, and the web app (`web/`). Your job is to make them feel playful, fast to read at a café table, and consistent. Read `AGENTS.md` first; the product principles are in [docs/product/principles.md](../../../docs/product/principles.md).

## Design principles

1. **Readable in 3 seconds.** A player glances down, reads, looks back up. One idea per message; lead with the point.
2. **One obvious action.** Every message has at most one primary button for the person reading it. Secondary actions go on a second row.
3. **Secrets look secret.** Messages that carry a word or role are short, start with 🤫, and stand alone so nobody has to scroll past them in front of others.
4. **Playful, never mean.** Banter-y Vietnamese like friends at a table ("chém cho khéo", "CHUẨN!"); never mock a player.
5. **Same thing, same look.** Reuse the emoji vocabulary and message anatomy below rather than inventing new ones.

## Visual identity

Two surfaces, one idea: in a set of things that match, one doesn't, and it is marked in **red stamp ink**. Chosen 2026-10-14: the icon is a playing card on a felt table; the web app is a classified dossier.

### Icon (Telegram avatar, PWA icons)

| Token | Hex | Use |
|---|---|---|
| Felt | `#1A5247` → `#0E302A` | Radial background, the card table |
| Ivory | `#F7F1E3` | The card |
| Ink | `#1F1A17` | Hat and the matching lens |
| Stamp red | `#B3261E` | Card frame, corner pips, **the odd lens** |

The mark is a card dealt face up with an incognito hat over round glasses; **one lens is red**, and only that lens has a glint, so it differs by more than colour. Keep that idea in any redesign.

### Web app ("Hồ sơ mật")

| Token | Hex | Use |
|---|---|---|
| `--kraft` | `#E9DCC0` | Page background (the folder), PWA theme colour |
| `--paper` | `#F6EEDB` | Cards, inputs, secondary buttons |
| `--paper-deep` | `#EFE3C8` | Chosen / pressed paper |
| `--rule` | `#8A7552` | Borders, dashed lines |
| `--ink` | `#2B241A` | Text, primary buttons, QR code |
| `--ink-soft` | `#6D5D40` | Secondary text |
| `--stamp` | `#B3261E` | The odd one out: spy in the reveal, chosen vote, timer, alerts, the "MẬT" stamp |

- Type: **IBM Plex Mono** (typewritten body) and **Oswald** (uppercase headings, labels, primary buttons). Both self-hosted through `@fontsource`, Vietnamese included; never load fonts from a third party.
- One light theme on purpose: it is paper. Red is the only accent; don't add a second one.
- The face-down word card is a sealed envelope with a rotated red "MẬT" stamp; face up it is a typed sheet. Same look for every role.
- Tokens live at the top of `web/src/styles.css`; components use the tokens, never literals.

### Themes (word packs)

- Every theme has one emoji, shown before its name in every picker and summary (`🍜 Đồ ăn`). Pick an emoji that is not already used by another theme.
- With many themes, pickers stay out of the way: on Telegram the lobby has one `📚 Chủ đề (k/N)` button that opens a separate panel (two themes per row, `✅ Bật tất cả`, `👌 Xong`), edited in place; on the web the picker is a folded section with a two-column grid.
- Summaries: all on → "tất cả N"; up to four → their emoji and names; more → "k/N" and the emoji.

### Avatar

- Source of truth: `telegram/avatar.svg` (hand-written SVG, commented). Render with `npm run avatar` → `telegram/avatar.jpg` and `web/public/icons/*.png`; commit all of them.
- Telegram constraints: square, JPG only (`setMyProfilePhoto`), shown as a **circle** — keep every element inside a radius of ~260 px around the centre of the 640 px canvas.
- Must read at 40 px (chat list): bold silhouette, no text, no thin lines under ~8 px at 640.
- Flat shapes, one soft drop shadow, one background gradient. No photos, no stock icons, no gradients on the glyph.
- Before committing, look at the rendered JPG (open it, or read it as an image) at full size and imagine it at 40 px inside a circle.
- Merging a change to the avatar uploads it automatically (`.github/workflows/telegram-profile.yml`); each upload adds a photo to the bot's history, so don't merge avatar tweaks one pixel at a time.

### Bot profile

`telegram/profile.json` is synced to Telegram on merge (name, short description, description, command menu). Limits are enforced by `src/telegram-profile.ts` and its tests:

| Field | Limit | Where players see it |
|---|---|---|
| `name` | 1–64 | Chat header |
| `short_description` | ≤ 120 | Bot profile page, shared links |
| `description` | ≤ 512 | Empty chat before pressing Start |
| `commands[]` | name `[a-z0-9_]{1,32}`, description 1–256 | The `/` autocomplete menu and the menu button |

Command descriptions are short imperatives in Vietnamese ("Mở phòng mới"). Every command listed must also appear in `/help` (a test checks this). Preview locally: `TELEGRAM_BOT_TOKEN=… npm run telegram:profile -- --dry-run`.

## Messages

All player-facing strings live in `src/bot/messages.ts`; button text too. Messages use Telegram HTML (`<b>`, `<i>`, `<code>`, links). Escape names and words with `esc()`.

### Anatomy

```
<emoji> <b>Title or the point</b>
Body: 1–3 short lines, or a numbered list.

Hint for the reader's next step (only for the person who can act).
```

### Emoji vocabulary

| Emoji | Meaning |
|---|---|
| 🏠 | Lobby / room |
| 🎬 | Game starts |
| 🤫 | Secret (your word, your role) |
| 🗣 | Speaking order |
| 🗳 | Vote |
| 📊 | Vote result |
| 🤝 | Tie |
| ❌ | Eliminated |
| ⏳ | Waiting on someone |
| 🎯 / 🙅 | Right / wrong guess |
| 🏆 | Winner |
| 🃏 | Reveal |
| 🏅 | Scores |
| 👑 | Host |
| 🚪 | Leaving |

### Buttons

- Emoji + verb, ≤ 20 characters: `▶️ Bắt đầu`, `🗳 Mở vote`, `🔁 Chơi lại`.
- Vote buttons are one name per row (easy to hit on a phone); the current choice gets `✅`.
- Host-only buttons only appear in the host's messages; never show a button the reader can't use.
- Every press gets an answer; popups (`show_alert`) only for private info or a refusal the player must notice.

### Edit in place vs. new message

- **Edit** what is a live status: the lobby list, a player's vote panel, the host's vote counter.
- **Send new** for things that happened: game started, round order, results, reveal. They form the story of the game in the chat.

## Accessibility

- Never carry meaning by colour alone; in the avatar the odd lens also differs in shine, and in messages meaning is in words, emoji are decoration.
- Keep emoji to one per line start; screen readers read them aloud.
- Text contrast on the avatar is not a concern (no text); glyph is white on a dark-to-violet gradient.

## Review checklist

- [ ] Reads in 3 seconds on a phone; the point is in the first line.
- [ ] Uses the emoji vocabulary and anatomy above; no new emoji without adding it here.
- [ ] Secret content only in the owner's DM or a popup.
- [ ] Buttons: ≤ 20 characters, one primary action, host-only actions only for the host.
- [ ] Strings only in `messages.ts`; tests updated if they match on text.
- [ ] Avatar: SVG, JPG and web icons committed together, inside the circle safe area, legible at 40 px.
- [ ] Web: colours only from the tokens in `web/src/styles.css`; red only for the odd one out and alerts; checked on a phone-width screenshot.
- [ ] `telegram/profile.json` passes `npm test`; `--dry-run` shows the expected diff.
