/**
 * Telegram players on the voice page. The bot's "Vào voice" button is a Telegram Login
 * button (login_url): Telegram opens /api/voice/login with the user's identity, signed with
 * the bot token (https://core.telegram.org/widgets/login#checking-authorization). The Worker
 * checks it and sets a voice-only cookie for that Telegram user. That cookie opens the call
 * and nothing else: no word, no role, no vote (AC9).
 */

export const VOICE_COOKIE = "a3spy_voice";
const MAX_AGE = 30 * 24 * 60 * 60;
/** How old a login may be: Telegram signs it when the button is tapped. */
export const LOGIN_MAX_AGE_S = 10 * 60;

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}

function equal(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  return x.byteLength === y.byteLength && crypto.subtle.timingSafeEqual(x, y);
}

/**
 * The Telegram user id in a login_url callback, or null when the signature is wrong or too old.
 * Parameters Telegram did not sign (our own `room`) are left out of the check.
 */
export async function verifyTelegramLogin(
  params: URLSearchParams,
  botToken: string,
  nowS: number,
): Promise<number | null> {
  const hash = params.get("hash");
  const id = Number(params.get("id"));
  const authDate = Number(params.get("auth_date"));
  if (!hash || !Number.isSafeInteger(id) || id <= 0 || !Number.isFinite(authDate)) return null;
  if (nowS - authDate > LOGIN_MAX_AGE_S || authDate - nowS > 60) return null;
  const signed = [...new Set(params.keys())]
    .filter((k) => k !== "hash" && k !== "room")
    .sort()
    .map((k) => `${k}=${params.get(k)}`)
    .join("\n");
  const secret = await crypto.subtle.digest("SHA-256", enc.encode(botToken));
  return equal(await hmac(secret, signed), hash) ? id : null;
}

/** Signs a Telegram user id for the voice cookie with a key derived from the bot token. */
async function sign(id: number, botToken: string): Promise<string> {
  const key = await crypto.subtle.digest("SHA-256", enc.encode(`a3spy-voice:${botToken}`));
  return hmac(key, String(id));
}

export async function voiceCookie(id: number, botToken: string): Promise<string> {
  return `${VOICE_COOKIE}=${id}.${await sign(id, botToken)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}

/** The Telegram user behind the request's voice cookie, or null. */
export async function voiceUserOf(request: Request, botToken: string): Promise<number | null> {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [k, v] = part.trim().split("=");
    if (k !== VOICE_COOKIE || !v) continue;
    const m = /^(\d{1,16})\.([0-9a-f]{64})$/.exec(v);
    if (!m) return null;
    const id = Number(m[1]);
    return equal(await sign(id, botToken), m[2] as string) ? id : null;
  }
  return null;
}
