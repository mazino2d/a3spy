import { webhookCallback } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import { createBot } from "./bot/bot";
import type { Env } from "./env";
import { handleApi } from "./web/api";

export { PlayerDO } from "./player/PlayerDO";
export { RoomDO } from "./room/RoomDO";

const SECRET_HEADER = "x-telegram-bot-api-secret-token";

/** Per-isolate cache of getMe; avoids one Telegram call per update. Not game state. */
let botInfo: UserFromGetMe | undefined;

function hasValidSecret(request: Request, expected: string): boolean {
  const enc = new TextEncoder();
  const given = enc.encode(request.headers.get(SECRET_HEADER) ?? "");
  const want = enc.encode(expected);
  return given.byteLength === want.byteLength && crypto.subtle.timingSafeEqual(given, want);
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/healthz") return new Response("ok");

    if (url.pathname.startsWith("/api/")) return handleApi(request, env);

    if (url.pathname === "/webhook" && request.method === "POST") {
      // Check before building the bot: grammY would otherwise call getMe for forged requests.
      if (!hasValidSecret(request, env.TELEGRAM_WEBHOOK_SECRET)) {
        return new Response("Unauthorized", { status: 401 });
      }
      const bot = createBot(env, botInfo ? { botInfo } : undefined);
      const handle = webhookCallback(bot, "cloudflare-mod", {
        secretToken: env.TELEGRAM_WEBHOOK_SECRET,
        // A room broadcast is a few dozen Telegram calls; give it room before Telegram retries.
        timeoutMilliseconds: 50_000,
      });
      const response = await handle(request);
      if (bot.isInited()) botInfo = bot.botInfo;
      return response;
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
