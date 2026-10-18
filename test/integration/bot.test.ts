import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encode } from "../helpers/oldCallbacks";
import { press, telegramStub, text } from "../helpers/telegram";
import { connect, createRoom, guest } from "../helpers/web";

let tg: ReturnType<typeof telegramStub>;

beforeEach(() => {
  tg = telegramStub();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const WEB = "https://a3spy.test";

describe("B2 X1 the bot is a signpost to the web", () => {
  it("B2 AC7 /start, /help, old game commands and any text get the intro and a web button", async () => {
    for (const body of [
      "/start",
      "/help",
      "/newgame",
      "/join AB12",
      "/leave",
      "/score",
      "/stats",
      "/end",
      "xin chào",
    ]) {
      tg.reset();
      await text(5101, body);
      const sent = tg.messages();
      expect(sent, body).toHaveLength(1);
      expect(sent[0]?.text).toContain("A3 Spy");
      expect(sent[0]?.text).toContain("Luật nhanh");
      expect(sent[0]?.buttons).toEqual([{ text: "🎮 Chơi trên web", data: WEB }]);
    }
  });

  it("X2 AC8 an old invite link answers with a button to that room on the web", async () => {
    await text(5201, "/start ab12");
    expect(tg.last(5201)?.text).toContain("AB12");
    expect(tg.last(5201)?.buttons).toEqual([{ text: "🚪 Vào phòng AB12", data: `${WEB}/r/AB12` }]);
  });

  it("X1 AC9 a tap on an old game button changes nothing and says the game moved", async () => {
    const host = await guest("Host");
    const code = await createRoom(host);
    const sock = await connect(host, code);
    await sock.next("state");
    for (const data of [encode("s", code), encode("v", code, 1, 1, -5), encode("c", code, 0, 0, -1), "garbage"]) {
      await press(5301, data);
      expect(tg.answers().at(-1)).toMatchObject({ text: expect.stringContaining("chuyển sang web"), show_alert: true });
    }
    // Nothing reached the room.
    await new Promise((r) => setTimeout(r, 50));
    expect(sock.messages.filter((m) => m.type === "state")).toHaveLength(1);
  });

  it("X1 AC14 the bot never sends anything but the signpost, room buttons and announcements", async () => {
    await text(5401, "/start");
    await text(5401, "/newgame");
    for (const m of tg.messages()) expect(m.text).not.toMatch(/Từ của bạn|spy của ván|Mr\. White không có từ:/i);
  });
});
