/** Signs Telegram Login parameters the way Telegram does, with the test bot token. */
export async function telegramLogin(id: number, room: string, authDate = Math.floor(Date.now() / 1000)) {
  const fields: Record<string, string> = { id: String(id), first_name: `User${id}`, auth_date: String(authDate) };
  const check = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const secret = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("123456:test-token"));
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(check));
  const hash = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return new URLSearchParams({ room, ...fields, hash });
}
