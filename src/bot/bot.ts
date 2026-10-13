import { Bot, type BotConfig, type Context } from "grammy";
import type { User } from "grammy/types";
import type { Env } from "../env";
import type { Player } from "../game/engine";
import { currentRoom as currentRoomOf } from "../player/pointer";
import { CODE, newRoomCode } from "../room/codes";
import { decode } from "./callbacks";
import { msg } from "./messages";

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

  bot.on("callback_query:data", async (ctx) => {
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
