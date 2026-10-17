import type { Api } from "grammy";
import type { InlineKeyboardMarkup } from "grammy/types";
import type { Keyboard } from "./render";

export function markup(keyboard: Keyboard | undefined): InlineKeyboardMarkup | undefined {
  return keyboard
    ? {
        inline_keyboard: keyboard.map((row) =>
          row.map((b) =>
            "login" in b
              ? { text: b.text, login_url: { url: b.login, request_write_access: false } }
              : { text: b.text, callback_data: b.data },
          ),
        ),
      }
    : undefined;
}

/** Sends a message; returns its id, or null when Telegram refuses (e.g. the user blocked the bot). */
export async function send(api: Api, chatId: number, text: string, keyboard?: Keyboard): Promise<number | null> {
  try {
    const reply_markup = markup(keyboard);
    const m = await api.sendMessage(chatId, text, { parse_mode: "HTML", ...(reply_markup ? { reply_markup } : {}) });
    return m.message_id;
  } catch (err) {
    console.warn("sendMessage failed", { chatId, error: describe(err) });
    return null;
  }
}

/** Edits a message in place; falls back to sending a new one. Returns the id that now holds the text. */
export async function editOrSend(
  api: Api,
  chatId: number,
  messageId: number | undefined,
  text: string,
  keyboard?: Keyboard,
): Promise<number | null> {
  if (messageId !== undefined) {
    try {
      const reply_markup = markup(keyboard);
      await api.editMessageText(chatId, messageId, text, {
        parse_mode: "HTML",
        ...(reply_markup ? { reply_markup } : {}),
      });
      return messageId;
    } catch (err) {
      if (describe(err).includes("message is not modified")) return messageId;
    }
  }
  return send(api, chatId, text, keyboard);
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
