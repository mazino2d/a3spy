import { Bot, type BotConfig, type Context } from "grammy";
import type { InlineKeyboardMarkup } from "grammy/types";
import { audienceOf, TEXT_MAX } from "../audience/AudienceDO";
import type { Env } from "../env";
import { CODE } from "../room/codes";
import { statsOf } from "../stats/LeaderboardDO";
import { webLink } from "../web/protocol";
import { msg } from "./messages";

/**
 * The bot after the game moved to the web (M7): a signpost to the web app, a door from old
 * invite links to their room on the web, and the owner's announcements. It runs no game.
 * @param webOrigin origin of the web app (the Worker's own)
 */
export function createBot(env: Env, config: BotConfig<Context> | undefined, webOrigin: string): Bot {
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN, config);
  // The bot only works in private chats; ignore groups and channels.
  const dm = bot.chatType("private");
  const isOwner = (userId: number) => env.OWNER_TELEGRAM_ID !== undefined && String(userId) === env.OWNER_TELEGRAM_ID;
  const link = (text: string, url: string): InlineKeyboardMarkup => ({ inline_keyboard: [[{ text, url }]] });
  const signpost = (ctx: Context) =>
    ctx.reply(msg.signpost, { parse_mode: "HTML", reply_markup: link(msg.btnPlay, webOrigin) });

  // Everyone who talks to the bot can hear about updates (B1 AC1).
  dm.use(async (ctx, next) => {
    await audienceOf(env).add(ctx.from.id);
    await next();
  });

  // Old invite links (t.me/<bot>?start=<code>) lead to the room on the web (X2).
  dm.command("start", (ctx) => {
    const code = ctx.match.trim().toUpperCase();
    if (!CODE.test(code)) return signpost(ctx);
    return ctx.reply(msg.roomMoved(code), {
      parse_mode: "HTML",
      reply_markup: link(msg.btnRoom(code), webLink(webOrigin, code)),
    });
  });

  // Owner only: preview an announcement, sent on confirmation. Anyone else gets the signpost.
  dm.command("announce", async (ctx) => {
    if (!isOwner(ctx.from.id)) return signpost(ctx);
    const text = ctx.match.trim();
    if (!text) return ctx.reply(msg.announceUsage);
    if (text.length > TEXT_MAX) return ctx.reply(msg.announceTooLong(TEXT_MAX));
    const { id, count } = await audienceOf(env).prepare(text);
    await ctx.reply(msg.announcePreview(count, text), {
      reply_markup: {
        inline_keyboard: [
          [
            { text: msg.btnAnnounceSend, callback_data: `an|${id}|send` },
            { text: msg.btnAnnounceCancel, callback_data: `an|${id}|cancel` },
          ],
        ],
      },
    });
  });

  // Owner only: wipe the leaderboard (e.g. test games), after confirming. Anyone else gets the signpost.
  dm.command("resetstats", async (ctx) => {
    if (!isOwner(ctx.from.id)) return signpost(ctx);
    const count = await statsOf(env).count();
    if (!count) return ctx.reply(msg.resetEmpty);
    await ctx.reply(msg.resetConfirm(count), {
      reply_markup: {
        inline_keyboard: [
          [
            { text: msg.btnResetConfirm, callback_data: "rs|go" },
            { text: msg.btnAnnounceCancel, callback_data: "rs|no" },
          ],
        ],
      },
    });
  });

  bot.on("callback_query:data", async (ctx) => {
    const reset = /^rs\|(go|no)$/.exec(ctx.callbackQuery.data);
    if (reset && isOwner(ctx.from.id)) {
      const text = reset[1] === "go" ? msg.resetDone(await statsOf(env).reset()) : msg.announceCancelled;
      await ctx.answerCallbackQuery({ text });
      await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }).catch(() => {});
      return;
    }
    const announce = /^an\|([0-9a-f]{8})\|(send|cancel)$/.exec(ctx.callbackQuery.data);
    // A button from an old game message: the game is on the web now (X1 AC9).
    if (!announce || !isOwner(ctx.from.id)) return ctx.answerCallbackQuery({ text: msg.moved, show_alert: true });
    const [, id, action] = announce as unknown as [string, string, string];
    const audience = audienceOf(env);
    const text =
      action === "cancel"
        ? (await audience.cancel(id))
          ? msg.announceCancelled
          : msg.announceStale
        : { started: msg.announceSending, stale: msg.announceStale, busy: msg.announceBusy }[
            await audience.start(id, ctx.from.id)
          ];
    await ctx.answerCallbackQuery({ text });
    // The preview's buttons are spent either way.
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }).catch(() => {});
  });

  // /help, the old game commands and any other message (B2).
  dm.on("message", signpost);

  return bot;
}
