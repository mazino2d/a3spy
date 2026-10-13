import type { Env } from "../env";

/**
 * Web guest sessions. The browser holds `<id>.<token>` in an HttpOnly cookie;
 * the guest's PlayerDO holds only the token's SHA-256. No accounts, no secret.
 */

export const COOKIE = "a3spy_session";
const MAX_AGE = 365 * 24 * 60 * 60;

export interface Guest {
  id: number;
  name: string;
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function hashToken(token: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}

/** A random negative ID below 2^48, so it can never collide with a Telegram user ID. */
export function newGuestId(): number {
  const [hi, lo] = crypto.getRandomValues(new Uint32Array(2)) as unknown as [number, number];
  return -((hi & 0xffff) * 2 ** 32 + lo + 1);
}

export function newToken(): string {
  return hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
}

export function cookieHeader(id: number, token: string): string {
  return `${COOKIE}=${id}.${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}

function readCookie(request: Request): { id: number; token: string } | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k !== COOKIE || !v) continue;
    const m = /^(-\d{1,16})\.([0-9a-f]{64})$/.exec(v);
    if (!m) return null;
    return { id: Number(m[1]), token: m[2] as string };
  }
  return null;
}

/** The guest behind the request's cookie, or null. */
export async function guestOf(request: Request, env: Env): Promise<Guest | null> {
  const c = readCookie(request);
  if (!c || c.id >= 0) return null;
  const name = await env.PLAYER.getByName(String(c.id)).verify(await hashToken(c.token));
  return name === null ? null : { id: c.id, name };
}

export async function createGuest(env: Env, name: string): Promise<{ guest: Guest; token: string }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = newGuestId();
    const token = newToken();
    if (await env.PLAYER.getByName(String(id)).createGuest(name, await hashToken(token))) {
      return { guest: { id, name }, token };
    }
  }
  throw new Error("could not allocate a guest id");
}
