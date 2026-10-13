import { SELF } from "cloudflare:test";
import type { ServerMessage } from "../../src/web/protocol";

const BASE = "https://a3spy.test";

export interface WebPlayer {
  id: number;
  name: string;
  cookie: string;
}

export async function api(path: string, init: RequestInit & { cookie?: string } = {}) {
  const { cookie, ...rest } = init;
  return SELF.fetch(`${BASE}${path}`, {
    ...rest,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(rest.headers ?? {}) },
  });
}

export async function guest(name: string): Promise<WebPlayer> {
  const res = await api("/api/session", { method: "POST", body: JSON.stringify({ name }) });
  if (!res.ok) throw new Error(`session failed: ${res.status}`);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const body = await res.json<{ id: number; name: string }>();
  return { ...body, cookie: setCookie.split(";")[0] as string };
}

export const createRoom = async (p: WebPlayer) =>
  (await (await api("/api/rooms", { method: "POST", cookie: p.cookie })).json<{ code: string }>()).code;

export const joinRoom = (p: WebPlayer, code: string) =>
  api(`/api/rooms/${code}/join`, { method: "POST", cookie: p.cookie });

/** An open socket that records every message the room sends. */
export interface Socket {
  ws: WebSocket;
  messages: ServerMessage[];
  send(msg: unknown): void;
  /** The latest unread message of a type, waiting up to ~1 s for it to arrive; marks everything up to it read. */
  next<T extends ServerMessage["type"]>(
    type: T,
    where?: (m: Extract<ServerMessage, { type: T }>) => boolean,
  ): Promise<Extract<ServerMessage, { type: T }>>;
  closed: Promise<{ code: number }>;
}

export async function connect(p: WebPlayer, code: string): Promise<Socket> {
  const res = await api(`/api/rooms/${code}/ws`, { cookie: p.cookie, headers: { upgrade: "websocket" } });
  const ws = res.webSocket;
  if (!ws) throw new Error(`no websocket: ${res.status}`);
  ws.accept();
  const messages: ServerMessage[] = [];
  ws.addEventListener("message", (e) => {
    messages.push(JSON.parse(String(e.data)));
  });
  const closed = new Promise<{ code: number }>((resolve) =>
    ws.addEventListener("close", (e) => resolve({ code: e.code })),
  );
  let seen = 0;
  return {
    ws,
    messages,
    closed,
    send: (msg) => ws.send(JSON.stringify(msg)),
    async next(type, where = () => true) {
      for (let i = 0; i < 100; i++) {
        const at = messages.findLastIndex((m, j) => j >= seen && m.type === type && where(m as never));
        if (at >= 0) {
          seen = at + 1;
          return messages[at] as never;
        }
        await new Promise((r) => setTimeout(r, 10));
      }
      throw new Error(`no "${type}" message; got ${JSON.stringify(messages.map((m) => m.type))}`);
    },
  };
}
