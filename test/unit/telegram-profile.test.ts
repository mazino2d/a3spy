import { describe, expect, it } from "vitest";
import { msg } from "../../src/bot/messages";
import { loadProfile } from "../../src/telegram-profile";
import raw from "../../telegram/profile.json";

describe("telegram/profile.json", () => {
  it("fits the Bot API limits", () => {
    expect(() => loadProfile(raw)).not.toThrow();
  });

  it("advertises only commands the bot documents in /help", () => {
    for (const { command } of loadProfile(raw).commands) expect(msg.help).toContain(`/${command}`);
  });

  it("rejects names and commands Telegram would refuse", () => {
    expect(() => loadProfile({ ...raw, name: "" })).toThrow("name");
    expect(() => loadProfile({ ...raw, commands: [{ command: "New-Game", description: "x" }] })).toThrow("New-Game");
    expect(() => loadProfile({ ...raw, short_description: "x".repeat(121) })).toThrow("short_description");
  });
});
