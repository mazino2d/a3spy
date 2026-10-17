import type { ClientMessage, ServerMessage } from "../../src/web/protocol";

export interface Me {
  id: number;
  name: string;
  room: string | null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly room?: string,
  ) {
    super(code);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; room?: string };
  if (!res.ok) throw new ApiError(res.status, body.error ?? "unknown", body.room);
  return body;
}

/** null when the browser has no session yet. */
export async function getMe(): Promise<Me | null> {
  try {
    return await call<Me>("/api/me");
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export interface Stats {
  id: number;
  name: string;
  games: number;
  wins: number;
  spy: { games: number; wins: number };
  white: { games: number; wins: number; correct: number };
}

export const getStats = () => call<{ me: Stats | null; board: Stats[] }>("/api/stats");

export const saveName = (name: string) =>
  call<{ id: number; name: string }>("/api/session", { method: "POST", body: JSON.stringify({ name }) });
export const createRoom = () => call<{ code: string }>("/api/rooms", { method: "POST" });
export const joinRoom = (code: string) => call<{ code: string }>(`/api/rooms/${code}/join`, { method: "POST" });
/** A Telegram player's voice page: null when the voice cookie is missing or expired. */
export async function getVoiceMe(code: string): Promise<{ id: number; inRoom: boolean } | null> {
  try {
    return await call<{ id: number; inRoom: boolean }>(`/api/voice/${code}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export const leaveRoom = (code: string) => call<object>(`/api/rooms/${code}/leave`, { method: "POST" });

export type SocketStatus = "connecting" | "open" | "offline" | "replaced" | "closed";

/**
 * The room's live connection. Reconnects on its own with backoff, and at once when the
 * page becomes visible again or the network comes back (a locked phone drops sockets).
 * Stops for good when the room says the player left, the room closed, or another tab took over.
 */
export class RoomSocket {
  private ws: WebSocket | null = null;
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;

  constructor(
    private readonly code: string,
    private readonly onMessage: (m: ServerMessage) => void,
    private readonly onStatus: (s: SocketStatus) => void,
    /** The voice page's socket instead of the room's. */
    private readonly path = `/api/rooms/${code}/ws`,
  ) {
    document.addEventListener("visibilitychange", this.wake);
    window.addEventListener("online", this.wake);
    this.connect();
  }

  send(message: ClientMessage): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(message));
    return true;
  }

  /** Reconnect after a takeover, when the player chooses to play here. */
  resume(): void {
    this.stopped = false;
    this.retry = 0;
    this.connect();
  }

  close(): void {
    this.stopped = true;
    clearTimeout(this.timer);
    document.removeEventListener("visibilitychange", this.wake);
    window.removeEventListener("online", this.wake);
    this.ws?.close();
  }

  private readonly wake = () => {
    if (this.stopped || document.visibilityState !== "visible") return;
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return;
    clearTimeout(this.timer);
    this.retry = 0;
    this.connect();
  };

  private connect(): void {
    this.onStatus("connecting");
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${scheme}://${location.host}${this.path}`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.onStatus("open");
    };
    ws.onmessage = (e) => {
      const message = JSON.parse(String(e.data)) as ServerMessage;
      if (message.type === "closed") this.stopped = true;
      this.onMessage(message);
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      if (e.code === 4002) return this.onStatus("replaced");
      if (this.stopped || e.code === 4000 || e.code === 4001) return this.onStatus("closed");
      this.onStatus("offline");
      const delay = Math.min(5000, 500 * 2 ** this.retry++);
      this.timer = setTimeout(() => this.connect(), delay);
    };
  }
}
