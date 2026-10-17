import { Bot, type BotConfig, type Context } from "grammy";
import type { User } from "grammy/types";
import { audienceOf, TEXT_MAX } from "../audience/AudienceDO";
import type { Env } from "../env";
import type { Player } from "../game/engine";
import { currentRoom as currentRoomOf } from "../player/pointer";
import { CODE, newRoomCode } from "../room/codes";
import { statsOf } from "../stats/StatsDO";
import { decode } from "./callbacks";
import { msg } from "./messages";
import { statsMessage } from "./render";

export function displayName(user: Pick<User, "first_name" | "last_name">): string {
  return [user.first_name, user.last_name]
    .filter((s): s is string => typeof s === "string" && s.trim() !== "")
    .join(" ")
    .trim();
}

const toPlayer = (user: User): Player => ({ id: user.id, name: displayName(user) || `#${user.id}` });

/** @param webOrigin origin of the web app (the Worker's own), shown in Telegram lobbies */
export function createBot(env: Env, config?: BotConfig<Context>, webOrigin: string | null = null): Bot {
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN, config);
  const roomOf = (code: string) => env.ROOM.getByName(code);
  const currentRoom = (userId: number) => currentRoomOf(env, userId);

  // The bot only works in private chats; ignore groups and channels.
  const dm = bot.chatType("private");
  const isOwner = (userId: number) => env.OWNER_TELEGRAM_ID !== undefined && String(userId) === env.OWNER_TELEGRAM_ID;

  // Everyone who talks to the bot can hear about updates (M7 B1, AC1).
  dm.use(async (ctx, next) => {
    await audienceOf(env).add(ctx.from.id);
    await next();
  });

  // Owner only: preview an announcement, sent on confirmation. Anyone else falls through.
  dm.command("announce", async (ctx, next) => {
    if (!isOwner(ctx.from.id)) return next();
    const text = ctx.match.trim();
    if (!text) return ctx.reply(msg.announceUsage);
    if (text.length > TEXT_MAX) return ctx.reply(msg.announceTooLong(TEXT_MAX));
    const audience = audienceOf(env);
    // Everyone who played on Telegram before the list existed hears the first announcement too.
    await audience.seedOnce(await statsOf(env).telegramIds());
    const { id, count } = await audience.prepare(text);
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

  async function joinRoom(ctx: Context, user: User, rawCode: string) {
    const code = rawCode.trim().toUpperCase();
    if (!CODE.test(code)) return ctx.reply(msg.joinUsage, { parse_mode: "HTML" });

    const current = await currentRoom(user.id);
    if (current === code) return ctx.reply(msg.alreadyInThisRoom(code), { parse_mode: "HTML" });
    if (current) return ctx.reply(msg.alreadyInRoom(current), { parse_mode: "HTML" });

    const outcome = await roomOf(code).join(toPlayer(user));
    if (outcome === "not_found") return ctx.reply(msg.roomNotFound(code), { parse_mode: "HTML" });
    if (outcome === "already_in_room") return ctx.reply(msg.alreadyInThisRoom(code), { parse_mode: "HTML" });
  }

  dm.command("start", async (ctx) => {
    if (ctx.match) return joinRoom(ctx, ctx.from, ctx.match);
    await ctx.reply(msg.welcome, { parse_mode: "HTML" });
  });

  dm.command("help", (ctx) => ctx.reply(msg.help, { parse_mode: "HTML" }));

  dm.command("join", (ctx) => joinRoom(ctx, ctx.from, ctx.match));

  dm.command("newgame", async (ctx) => {
    const current = await currentRoom(ctx.from.id);
    if (current) return ctx.reply(msg.alreadyInRoom(current), { parse_mode: "HTML" });
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newRoomCode();
      if (await roomOf(code).create(code, toPlayer(ctx.from), { botUsername: ctx.me.username, webOrigin })) return;
    }
    throw new Error("could not allocate a room code");
  });

  dm.command("leave", async (ctx) => {
    const current = await currentRoom(ctx.from.id);
    if (!current) return ctx.reply(msg.notInRoom, { parse_mode: "HTML" });
    await roomOf(current).leave(ctx.from.id);
  });

  dm.command("end", async (ctx) => {
    const current = await currentRoom(ctx.from.id);
    if (!current) return ctx.reply(msg.notInRoom, { parse_mode: "HTML" });
    const error = await roomOf(current).end(ctx.from.id);
    if (error) await ctx.reply(error, { parse_mode: "HTML" });
  });

  dm.command("score", async (ctx) => {
    const current = await currentRoom(ctx.from.id);
    if (!current) return ctx.reply(msg.notInRoom, { parse_mode: "HTML" });
    await ctx.reply(await roomOf(current).score(), { parse_mode: "HTML" });
  });

  dm.command("stats", async (ctx) => {
    const { me, board } = await statsOf(env).read(ctx.from.id);
    await ctx.reply(statsMessage(me, board), { parse_mode: "HTML" });
  });

  bot.on("callback_query:data", async (ctx) => {
    const announce = /^an\|([0-9a-f]{8})\|(send|cancel)$/.exec(ctx.callbackQuery.data);
    if (announce) {
      if (!isOwner(ctx.from.id)) return ctx.answerCallbackQuery({ text: msg.stale });
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
      return;
    }
    const cb = decode(ctx.callbackQuery.data);
    if (!cb) return ctx.answerCallbackQuery({ text: msg.stale });
    const answer = await roomOf(cb.code).onCallback(ctx.from.id, cb);
    await ctx.answerCallbackQuery({ text: answer.text, show_alert: answer.alert ?? false });
  });

  dm.on("message:text", async (ctx) => {
    const current = await currentRoom(ctx.from.id);
    if (current && (await roomOf(current).onText(ctx.from.id, ctx.message.text))) return;
    await ctx.reply(msg.unknownText);
  });

  return bot;
}
