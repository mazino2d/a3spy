import { describe, expect, it } from "vitest";
import { msg } from "../../src/bot/messages";
import { loadProfile } from "../../src/telegram-profile";
import raw from "../../telegram/profile.json";

describe("telegram/profile.json", () => {
  it("fits the Bot API limits", () => {
    expect(() => loadProfile(raw)).not.toThrow();
  });

  it("B2 AC10 advertises only /start and /help, and points to the web app", () => {
    expect(loadProfile(raw).commands.map((c) => c.command)).toEqual(["start", "help"]);
    expect(raw.description).toContain("https://a3spy.mazino2d.workers.dev");
    expect(msg.signpost).not.toContain("/newgame");
  });

  it("rejects names and commands Telegram would refuse", () => {
    expect(() => loadProfile({ ...raw, name: "" })).toThrow("name");
    expect(() => loadProfile({ ...raw, commands: [{ command: "New-Game", description: "x" }] })).toThrow("New-Game");
    expect(() => loadProfile({ ...raw, short_description: "x".repeat(121) })).toThrow("short_description");
  });
});
