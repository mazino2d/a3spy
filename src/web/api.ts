import type { Env } from "../env";
import { currentRoom } from "../player/pointer";
import { CODE, newRoomCode } from "../room/codes";
import { statsOf } from "../stats/StatsDO";
import { cleanName } from "./protocol";
import { cookieHeader, createGuest, type Guest, guestOf } from "./session";
import { verifyTelegramLogin, voiceCookie, voiceUserOf } from "./voiceAuth";

/**
 * JSON API for the web app. Every response is `no-store`: nothing the API
 * returns may be cached by the browser or the service worker.
 *
 *   POST /api/session                 { name } → { id, name }  (sets the cookie, or renames)
 *   GET  /api/me                      → { id, name, room }
 *   GET  /api/stats                   → { me, board }  (long-term stats, no words)
 *   POST /api/rooms                   → { code }
 *   POST /api/rooms/<code>/join       → { code }
 *   POST /api/rooms/<code>/leave      → {}
 *   GET  /api/rooms/<code>/ws         WebSocket, see src/web/protocol.ts
 *
 * Telegram players on the voice page (src/web/voiceAuth.ts), with the voice cookie only:
 *   GET  /api/voice/login?room=<code>&…  Telegram Login callback → cookie, 302 to /v/<code>
 *   GET  /api/voice/<code>               → { id, inRoom }
 *   GET  /api/voice/<code>/ws            voice-only WebSocket: voice messages, never room state
 */

/** Header the Worker sets when forwarding a socket to a RoomDO. A DO is only reachable through its binding. */
export const PLAYER_HEADER = "x-a3spy-player";
/** Set with PLAYER_HEADER when the socket is a Telegram player's voice page. */
export const VOICE_HEADER = "x-a3spy-voice";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
const error = (code: string, status: number, extra: Record<string, unknown> = {}) =>
  json({ error: code, ...extra }, status);

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const method = request.method;

  if (path === "/api/session" && method === "POST") return session(request, env);
  if (path.startsWith("/api/voice/") && method === "GET") return voice(request, env, url, path);

  const guest = await guestOf(request, env);
  if (!guest) return error("no_session", 401);

  if (path === "/api/me" && method === "GET") {
    return json({ ...guest, room: await currentRoom(env, guest.id) });
  }
  if (path === "/api/stats" && method === "GET") return json(await statsOf(env).read(guest.id));
  if (path === "/api/rooms" && method === "POST") return createRoom(env, guest, url.origin);

  const m = /^\/api\/rooms\/([A-Za-z0-9]{4})\/(join|leave|ws)$/.exec(path);
  if (!m) return error("not_found", 404);
  const code = (m[1] as string).toUpperCase();
  if (!CODE.test(code)) return error("not_found", 404);
  const room = env.ROOM.getByName(code);

  switch (`${method} ${m[2]}`) {
    case "POST join": {
      const current = await currentRoom(env, guest.id);
      if (current && current !== code) return error("in_other_room", 409, { room: current });
      if (current === code) return json({ code });
      const outcome = await room.join(guest);
      if (outcome === "not_found") return error("room_not_found", 404);
      return json({ code });
    }
    case "POST leave":
      if ((await currentRoom(env, guest.id)) === code) await room.leave(guest.id);
      return json({});
    case "GET ws": {
      if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return error("expected_websocket", 426);
      const forwarded = new Request(request.url, { headers: request.headers });
      forwarded.headers.set(PLAYER_HEADER, String(guest.id));
      return room.fetch(forwarded);
    }
    default:
      return error("not_found", 404);
  }
}

async function voice(request: Request, env: Env, url: URL, path: string): Promise<Response> {
  if (path === "/api/voice/login") {
    const code = (url.searchParams.get("room") ?? "").toUpperCase();
    if (!CODE.test(code)) return error("not_found", 404);
    const id = await verifyTelegramLogin(url.searchParams, env.TELEGRAM_BOT_TOKEN, Math.floor(Date.now() / 1000));
    const headers: Record<string, string> = { location: id ? `/v/${code}` : `/v/${code}?login=failed` };
    if (id) headers["set-cookie"] = await voiceCookie(id, env.TELEGRAM_BOT_TOKEN);
    return new Response(null, { status: 302, headers: { ...headers, "cache-control": "no-store" } });
  }

  const m = /^\/api\/voice\/([A-Za-z0-9]{4})(\/ws)?$/.exec(path);
  const code = (m?.[1] ?? "").toUpperCase();
  if (!m || !CODE.test(code)) return error("not_found", 404);
  const id = await voiceUserOf(request, env.TELEGRAM_BOT_TOKEN);
  if (!id) return error("no_session", 401);
  const room = env.ROOM.getByName(code);
  if (!m[2]) return json({ id, inRoom: await room.has(id) });

  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return error("expected_websocket", 426);
  const forwarded = new Request(request.url, { headers: request.headers });
  forwarded.headers.set(PLAYER_HEADER, String(id));
  forwarded.headers.set(VOICE_HEADER, "1");
  return room.fetch(forwarded);
}

async function session(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{ name?: unknown }>().catch(() => ({ name: undefined }));
  const name = cleanName(body.name);
  if (!name) return error("bad_name", 400);

  const existing = await guestOf(request, env);
  if (existing) {
    await env.PLAYER.getByName(String(existing.id)).rename(name);
    return json({ id: existing.id, name });
  }
  const { guest, token } = await createGuest(env, name);
  return json(guest, 200, { "set-cookie": cookieHeader(guest.id, token) });
}

async function createRoom(env: Env, guest: Guest, webOrigin: string): Promise<Response> {
  const current = await currentRoom(env, guest.id);
  if (current) return error("in_other_room", 409, { room: current });
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newRoomCode();
    if (await env.ROOM.getByName(code).create(code, guest, { botUsername: env.TELEGRAM_BOT_USERNAME, webOrigin }))
      return json({ code });
  }
  return error("no_room_code", 503);
}
