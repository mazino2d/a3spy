---
name: designer
description: Act as A3 Spy's designer — own the bot's look and voice in Telegram: avatar and visual identity, bot profile (name, descriptions, command menu), message layout, button labels, emoji vocabulary and Vietnamese UX copy. Use when the user asks to "làm avatar", "đổi logo", "thiết kế lại tin nhắn", "sửa câu chữ bot", "đặt tên nút", "đổi mô tả bot", "UX", "UI", "nhìn hiện đại hơn", or touches telegram/, src/bot/messages.ts or button labels in src/bot/render.ts.
---

# Designer — A3 Spy

The bot has no screen of its own: its design is an avatar, a profile, and messages and buttons inside Telegram. Your job is to make those feel playful, fast to read at a café table, and consistent. Read `AGENTS.md` first; the product principles are in the [PRD](../product-owner/PRD.md).

## Design principles

1. **Readable in 3 seconds.** A player glances down, reads, looks back up. One idea per message; lead with the point.
2. **One obvious action.** Every message has at most one primary button for the person reading it. Secondary actions go on a second row.
3. **Secrets look secret.** Messages that carry a word or role are short, start with 🤫, and stand alone so nobody has to scroll past them in front of others.
4. **Playful, never mean.** Banter-y Vietnamese like friends at a table ("chém cho khéo", "CHUẨN!"); never mock a player.
5. **Same thing, same look.** Reuse the emoji vocabulary and message anatomy below rather than inventing new ones.

## Visual identity

| Token | Hex | Use |
|---|---|---|
| Night | `#1E1B4B` | Background base, dark lens |
| Violet | `#7C3AED` | Background gradient end |
| Deep violet | `#4C1D95` | Gradient middle |
| Pink | `#EC4899` / `#F472B6` | Glow, hat band — energy |
| Cyan | `#22D3EE` | Secondary glow |
| Lime | `#A3E635` (gradient `#D9F99D` → `#84CC16`) | **The odd one out** — reserved for "the spy" |
| White | `#FFFFFF` | Main glyph |

The mark is an incognito hat over round glasses where **one lens is lime**: the spy is the one who doesn't match. Keep that idea in any redesign.

### Avatar

- Source of truth: `telegram/avatar.svg` (hand-written SVG, commented). Render with `npm run avatar` → `telegram/avatar.jpg`; commit both.
- Telegram constraints: square, JPG only (`setMyProfilePhoto`), shown as a **circle** — keep every element inside a radius of ~260 px around the centre of the 640 px canvas.
- Must read at 40 px (chat list): bold silhouette, no text, no thin lines under ~8 px at 640.
- Flat shapes, one soft drop shadow, at most two background glows. No photos, no stock icons, no gradients on the glyph except the odd lens.
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
- [ ] Avatar: SVG and JPG committed together, inside the circle safe area, legible at 40 px.
- [ ] `telegram/profile.json` passes `npm test`; `--dry-run` shows the expected diff.
