import { webhookCallback } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import { createBot } from "./bot/bot";
import type { Env } from "./env";
import { handleApi } from "./web/api";

export { AudienceDO } from "./audience/AudienceDO";
export { GuestDO } from "./player/GuestDO";
export { GameRoomDO } from "./room/GameRoomDO";
export { LeaderboardDO } from "./stats/LeaderboardDO";

const SECRET_HEADER = "x-telegram-bot-api-secret-token";

/** Per-isolate cache of getMe; avoids one Telegram call per update. Not game state. */
let botInfo: UserFromGetMe | undefined;

function hasValidSecret(request: Request, expected: string): boolean {
  const enc = new TextEncoder();
  const given = enc.encode(request.headers.get(SECRET_HEADER) ?? "");
  const want = enc.encode(expected);
  return given.byteLength === want.byteLength && crypto.subtle.timingSafeEqual(given, want);
}

const RULES_TITLE = "Luật chơi Who is Spy · A3 Spy";
const RULES_DESCRIPTION = "Luật Who is Spy trong 1 phút: Dân, Spy, Mr. White, vote và cách thắng. Chơi ngay trên web.";

async function rulesPage(env: Env, url: URL): Promise<Response> {
  const page = await env.ASSETS.fetch(new Request(new URL("/", url)));
  const set = (attr: string) => ({
    element: (el: Element) => {
      el.setAttribute("content", attr);
    },
  });
  return new HTMLRewriter()
    .on("title", {
      element: (el) => {
        el.setInnerContent(RULES_TITLE);
      },
    })
    .on('meta[name="description"]', set(RULES_DESCRIPTION))
    .on("head", {
      element: (el) => {
        el.append(
          `<meta property="og:title" content="${RULES_TITLE}" /><meta property="og:description" content="${RULES_DESCRIPTION}" /><meta property="og:url" content="${url.origin}/luat" />`,
          { html: true },
        );
      },
    })
    .transform(page);
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/healthz") return new Response("ok");

    if (url.pathname.startsWith("/api/")) return handleApi(request, env);

    // The rules page is sent to friends: give link previews its own title (crawlers run no JS).
    if (url.pathname === "/luat") return rulesPage(env, url);

    if (url.pathname === "/webhook" && request.method === "POST") {
      // Check before building the bot: grammY would otherwise call getMe for forged requests.
      if (!hasValidSecret(request, env.TELEGRAM_WEBHOOK_SECRET)) {
        return new Response("Unauthorized", { status: 401 });
      }
      // Telegram calls the Worker's own URL, which also serves the web app.
      const bot = createBot(env, botInfo ? { botInfo } : undefined, url.origin);
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
