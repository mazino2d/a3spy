import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { press, telegramStub, text } from "../helpers/telegram";

let tg: ReturnType<typeof telegramStub>;

beforeEach(() => {
  tg = telegramStub();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const button = (chat: number, label: string) => {
  const b = tg
    .to(chat)
    .flatMap((m) => m.buttons)
    .filter((x) => x.text.includes(label))
    .at(-1);
  if (!b) throw new Error(`no "${label}" button for ${chat}`);
  return b.data;
};

/** First player opens the room and is host; the rest join by deep link. */
async function openRoom(players: number[]): Promise<string> {
  const [host, ...rest] = players as [number, ...number[]];
  await text(host, "/newgame");
  const code = /Phòng (\w{4})/.exec(tg.last(host)?.text ?? "")?.[1] as string;
  for (const id of rest) await text(id, `/start ${code}`);
  return code;
}

describe("rooms over the webhook", () => {
  it("L1 /newgame creates a room with an invite link and makes the creator host", async () => {
    await text(101, "/newgame");
    const lobby = tg.last(101);
    expect(lobby?.text).toMatch(/Phòng \w{4}/);
    expect(lobby?.text).toMatch(/https:\/\/t\.me\/a3spy_bot\?start=\w{4}/);
    expect(lobby?.buttons.map((b) => b.text)).toEqual(expect.arrayContaining([expect.stringContaining("Bắt đầu")]));
  });

  it("W7 AC18 the Telegram lobby also links to the room on the web", async () => {
    await text(103, "/newgame");
    expect(tg.last(103)?.text).toMatch(/Không dùng Telegram\? Mở web: https:\/\/a3spy\.test\/r\/\w{4}/);
  });

  it("L1 /newgame while already in a room is refused", async () => {
    await text(102, "/newgame");
    await text(102, "/newgame");
    expect(tg.last(102)?.text).toContain("/leave");
  });

  it("L2 joining by deep link updates every lobby in place", async () => {
    const code = await openRoom([201, 202]);
    await text(203, `/join ${code.toLowerCase()}`);
    const hostLobby = tg.last(201);
    expect(hostLobby?.text).toContain("User203");
    expect(tg.calls.some((c) => c.method === "editMessageText" && c.body.chat_id === 202)).toBe(true);
  });

  it("L2 unknown room codes are reported", async () => {
    await text(301, "/join ZZZZ");
    expect(tg.last(301)?.text).toContain("Không tìm thấy phòng");
  });

  it("L3 starting with fewer than 3 players is refused with a popup", async () => {
    await openRoom([401, 402]);
    await press(401, button(401, "Bắt đầu"));
    expect(tg.answers().at(-1)?.text).toContain("ít nhất 3");
  });

  it("L3 /leave removes the player and refreshes the others", async () => {
    await openRoom([501, 502, 503]);
    await text(503, "/leave");
    expect(tg.last(503)?.text).toContain("đã rời phòng");
    expect(tg.last(501)?.text).not.toContain("User503");
  });
});

describe("a full game over the webhook", () => {
  it("R1 G1 G2 G3 E1 deals secretly, runs a vote and ends with a reveal", async () => {
    const players = [601, 602, 603, 604];
    const HOST = 601;
    await openRoom(players);
    const startButton = button(HOST, "Bắt đầu");
    tg.reset();
    await press(HOST, startButton);

    // R1: every player gets exactly one private word message; 4 players → 1 spy, no Mr. White.
    const words = new Map<number, string>();
    for (const id of players) {
      const deal = tg.to(id).find((m) => m.text.includes("Từ của bạn"));
      const word = /Từ của bạn: <b>(.+?)<\/b>/.exec(deal?.text ?? "")?.[1];
      expect(word).toBeDefined();
      words.set(id, word as string);
    }
    const counts = new Map<string, number[]>();
    for (const [id, w] of words) counts.set(w, [...(counts.get(w) ?? []), id]);
    expect([...counts.values()].map((ids) => ids.length).sort()).toEqual([1, 3]);
    const spy = ([...counts.values()].find((ids) => ids.length === 1) as number[])[0] as number;
    const spyWord = words.get(spy) as string;

    // Secrecy: the spy's word reaches nobody else before the reveal.
    for (const id of players.filter((p) => p !== spy)) {
      expect(tg.to(id).some((m) => m.text.includes(spyWord))).toBe(false);
    }
    // No word in any callback payload.
    for (const m of tg.messages())
      for (const b of m.buttons) for (const w of words.values()) expect(b.data).not.toContain(w);

    // G1: speaking order announced to everyone.
    for (const id of players) expect(tg.to(id).some((m) => m.text.includes("Vòng 1"))).toBe(true);

    // R2: the word button shows the word privately.
    await press(spy, button(spy, "Xem từ"));
    expect(tg.answers().at(-1)).toMatchObject({ text: `Từ của bạn: ${spyWord}`, show_alert: true });

    // G2: only the host can open the vote.
    // A civilian other than the host: the spy votes for them, and they check /score later.
    const other = players.find((p) => p !== HOST && p !== spy) as number;
    await press(HOST, button(HOST, "Mở vote"));
    for (const id of players) expect(tg.to(id).some((m) => m.text.includes("Vote vòng 1"))).toBe(true);

    // Everyone votes the spy out (the spy votes someone else).
    const ballots = players.map((id) => [id, button(id, `User${id === spy ? other : spy}`)] as const);
    tg.reset();
    for (const [id, data] of ballots) await press(id, data);

    // G3 + E1: elimination, civilians win, full reveal with both words.
    const end = tg.last(HOST)?.text ?? "";
    expect(end).toContain(`User${spy} bị loại`);
    expect(end).toContain("Dân thắng");
    expect(end).toContain(spyWord);
    expect(tg.last(HOST)?.buttons.map((b) => b.text)).toEqual(
      expect.arrayContaining([expect.stringContaining("Chơi lại")]),
    );

    // S1: civilians scored.
    await text(other, "/score");
    expect(tg.last(other)?.text).toMatch(/User\d+: 1/);

    // E2: play again re-deals the same players.
    const again = button(HOST, "Chơi lại");
    tg.reset();
    await press(HOST, again);
    expect(tg.to(HOST).some((m) => m.text.includes("Ván #2"))).toBe(true);
  });

  it("G2 stale vote buttons are answered and ignored", async () => {
    const players = [701, 702, 703, 704, 705];
    await openRoom(players);
    await press(701, button(701, "Bắt đầu"));
    await press(701, button(701, "Mở vote"));
    const old = button(702, "User703");
    await press(701, button(701, "Chốt vote"));
    tg.reset();
    await press(702, old);
    expect(tg.answers().at(-1)?.text).toContain("vòng trước");
    expect(tg.messages()).toHaveLength(0);
  });

  it("E3 only the host can /end, and it reveals without scoring", async () => {
    await openRoom([801, 802, 803]);
    await press(801, button(801, "Bắt đầu"));
    await text(802, "/end");
    expect(tg.last(802)?.text).toContain("Chỉ host");
    await text(801, "/end");
    expect(tg.last(803)?.text).toContain("kết thúc sớm");
    expect(tg.last(803)?.text).toContain("Lật bài");
  });
});

describe("web players in a Telegram room", () => {
  it("W7 web players get no Telegram messages, Telegram players still do", async () => {
    const { env } = await import("cloudflare:test");
    const code = await openRoom([901, 902]);
    tg.reset();
    expect(await env.ROOM.getByName(code).join({ id: -5, name: "Web" })).toBe("ok");
    await press(901, button(901, "Bắt đầu"));
    const chats = new Set(tg.messages().map((m) => m.chat));
    expect(chats.has(-5)).toBe(false);
    expect(chats.has(901) && chats.has(902)).toBe(true);
    expect(tg.last(901)?.text).toContain("Web");
    expect(await env.PLAYER.getByName("-5").room()).toBe(code);
  });
});

describe("host settings over Telegram", () => {
  it("L4 AC1 AC2 only the host gets settings buttons; a change updates every lobby", async () => {
    await openRoom([1101, 1102, 1103, 1104, 1105]);
    expect(tg.last(1101)?.text).toContain("1 spy · Mr. White: có");
    expect(tg.last(1101)?.text).toContain("Chủ đề: tất cả");
    expect(
      tg
        .to(1102)
        .flatMap((m) => m.buttons)
        .some((b) => b.text.includes("Spy")),
    ).toBe(false);

    await press(1101, button(1101, "➕ Spy"));
    const other = tg.last(1102)?.text ?? "";
    expect(other).toContain("2 spy · Mr. White: có");
    expect(other).not.toContain("tự động");
    // 2 spies + Mr. White with 5 players: the host is warned before starting.
    expect(tg.last(1101)?.text).toContain("Dân phải đông hơn");
  });

  it("L4 AC3 starting with bad counts is refused with a reason", async () => {
    await openRoom([1201, 1202, 1203, 1204, 1205]);
    await press(1201, button(1201, "➕ Spy"));
    const startButton = button(1201, "Bắt đầu");
    tg.reset();
    await press(1201, startButton);
    expect(tg.answers().at(-1)?.text).toContain("Dân phải đông hơn");
    expect(tg.messages().some((m) => m.text.includes("Từ của bạn"))).toBe(false);
  });

  it("L4 a theme can be turned off and back on", async () => {
    await openRoom([1301, 1302, 1303]);
    await press(1301, button(1301, "✅ Đồ ăn"));
    expect(tg.last(1302)?.text).not.toContain("Chủ đề: tất cả");
    expect(tg.last(1302)?.text).not.toContain("Đồ ăn");
    await press(1301, button(1301, "⬜ Đồ ăn"));
    expect(tg.last(1302)?.text).toContain("Chủ đề: tất cả");
  });
});
