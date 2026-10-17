import { describe, expect, it } from "vitest";
import { LOGIN_MAX_AGE_S, VOICE_COOKIE, verifyTelegramLogin, voiceCookie, voiceUserOf } from "../../src/web/voiceAuth";
import { telegramLogin } from "../helpers/voiceLogin";

const TOKEN = "123456:test-token";
const NOW = 1_800_000_000;

describe("V4 Telegram Login for the voice page", () => {
  it("V4 AC10 accepts a fresh login signed with the bot token, ignoring our room parameter", async () => {
    expect(await verifyTelegramLogin(await telegramLogin(1001, "AB12", NOW), TOKEN, NOW)).toBe(1001);
  });

  it("V4 AC10 refuses a tampered, foreign or stale login", async () => {
    const params = await telegramLogin(1001, "AB12", NOW);
    const tampered = new URLSearchParams(params);
    tampered.set("id", "1002");
    expect(await verifyTelegramLogin(tampered, TOKEN, NOW)).toBeNull();
    expect(await verifyTelegramLogin(params, "999:other-bot", NOW)).toBeNull();
    expect(await verifyTelegramLogin(params, TOKEN, NOW + LOGIN_MAX_AGE_S + 1)).toBeNull();
    const noHash = new URLSearchParams(params);
    noHash.delete("hash");
    expect(await verifyTelegramLogin(noHash, TOKEN, NOW)).toBeNull();
  });

  it("V4 AC10 the voice cookie names one Telegram user and cannot be forged", async () => {
    const cookie = (await voiceCookie(1001, TOKEN)).split(";")[0] as string;
    expect(cookie).toMatch(new RegExp(`^${VOICE_COOKIE}=1001\\.[0-9a-f]{64}$`));
    const req = (c: string) => new Request("https://x/", { headers: { cookie: c } });
    expect(await voiceUserOf(req(cookie), TOKEN)).toBe(1001);
    expect(await voiceUserOf(req(cookie.replace("=1001.", "=1002.")), TOKEN)).toBeNull();
    expect(await voiceUserOf(req(cookie), "999:other-bot")).toBeNull();
    expect(await voiceUserOf(req("a3spy_session=-1.abc"), TOKEN)).toBeNull();
  });
});
