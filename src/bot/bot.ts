import { Bot, type BotConfig, type Context } from "grammy";
import type { Env } from "../env";
import { msg } from "./messages";

export function createBot(env: Env, config?: BotConfig<Context>): Bot {
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN, config);

  // The bot only works in private chats; ignore groups and channels.
  const dm = bot.chatType("private");

  dm.command("start", async (ctx) => {
    await ctx.reply(msg.welcome, { parse_mode: "HTML" });
  });

  dm.command("help", async (ctx) => {
    await ctx.reply(msg.help, { parse_mode: "HTML" });
  });

  dm.command(["newgame", "join"], async (ctx) => {
    await ctx.reply(msg.comingSoon);
  });

  return bot;
}
