import { webhookCallback } from "grammy";
import { createBot } from "./bot/bot";
import type { Env } from "./env";

const SECRET_HEADER = "x-telegram-bot-api-secret-token";

function hasValidSecret(request: Request, expected: string): boolean {
  const enc = new TextEncoder();
  const given = enc.encode(request.headers.get(SECRET_HEADER) ?? "");
  const want = enc.encode(expected);
  return (
    given.byteLength === want.byteLength &&
    crypto.subtle.timingSafeEqual(given, want)
  );
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/healthz") return new Response("ok");

    if (url.pathname === "/webhook" && request.method === "POST") {
      // Check before building the bot: grammY would otherwise call getMe for forged requests.
      if (!hasValidSecret(request, env.TELEGRAM_WEBHOOK_SECRET)) {
        return new Response("Unauthorized", { status: 401 });
      }
      const handle = webhookCallback(createBot(env), "cloudflare-mod", {
        secretToken: env.TELEGRAM_WEBHOOK_SECRET,
      });
      return handle(request);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
