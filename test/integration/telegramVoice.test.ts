import { SELF } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerMessage } from "../../src/web/protocol";
import { realtimeStub } from "../helpers/realtime";
import { press, telegramStub, text } from "../helpers/telegram";
import { telegramLogin } from "../helpers/voiceLogin";
import { api, guest, type Socket } from "../helpers/web";

let tg: ReturnType<typeof telegramStub>;
let rt: ReturnType<typeof realtimeStub>;

beforeEach(() => {
  tg = telegramStub();
  rt = realtimeStub();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const buttons = (chat: number) => tg.to(chat).flatMap((m) => m.buttons);
const button = (chat: number, label: string) => {
  const b = buttons(chat)
    .filter((x) => x.text.includes(label))
    .at(-1);
  if (!b) throw new Error(`no "${label}" button for ${chat}`);
  return b.data;
};

async function openRoom(players: number[]): Promise<string> {
  const [host, ...rest] = players as [number, ...number[]];
  await text(host, "/newgame");
  const code = /Phòng (\w{4})/.exec(tg.last(host)?.text ?? "")?.[1] as string;
  for (const id of rest) await text(id, `/start ${code}`);
  return code;
}

/** Logs a Telegram user in through the voice button's callback; returns their voice cookie. */
async function login(id: number, code: string): Promise<string> {
  const res = await api(`/api/voice/login?${await telegramLogin(id, code)}`, { redirect: "manual" });
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe(`/v/${code}`);
  return (res.headers.get("set-cookie") ?? "").split(";")[0] as string;
}

async function voiceSocket(cookie: string, code: string): Promise<Socket> {
  const res = await SELF.fetch(`https://a3spy.test/api/voice/${code}/ws`, {
    headers: { cookie, upgrade: "websocket" },
  });
  const ws = res.webSocket;
  if (!ws) throw new Error(`no websocket: ${res.status}`);
  ws.accept();
  const messages: ServerMessage[] = [];
  ws.addEventListener("message", (e) => messages.push(JSON.parse(String(e.data))));
  const closed = new Promise<{ code: number }>((r) => ws.addEventListener("close", (e) => r({ code: e.code })));
  let seen = 0;
  return {
    ws,
    messages,
    closed,
    send: (m) => ws.send(JSON.stringify(m)),
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

describe("V4 Telegram players join the call", () => {
  it("V4 AC8 the lobby and round messages carry Vào voice only when the room is online", async () => {
    const code = await openRoom([2101, 2102, 2103]);
    expect(buttons(2102).some((b) => b.text.includes("Vào voice"))).toBe(false);

    await press(2101, button(2101, "Chơi online"));
    const link = `https://a3spy.test/api/voice/login?room=${code}`;
    expect(button(2102, "Vào voice")).toBe(link);
    expect(button(2101, "Vào voice")).toBe(link);

    const start = button(2101, "Bắt đầu");
    tg.reset();
    await press(2101, start);
    const round = tg.to(2102).find((m) => m.text.includes("Vòng 1"));
    expect(round?.buttons.map((b) => b.data)).toContain(link);
  });

  it("V4 AC8 AC9 the voice page joins the call and never receives the word, role or room state", async () => {
    const code = await openRoom([2201, 2202, 2203]);
    await press(2201, button(2201, "Chơi online"));
    const cookie = await login(2202, code);

    expect(await (await api(`/api/voice/${code}`, { cookie })).json()).toEqual({ id: 2202, inRoom: true });
    const vs = await voiceSocket(cookie, code);
    expect(await vs.next("voice")).toEqual({ type: "voice", on: true, members: [] });

    vs.send({ type: "voice", op: "join", sdp: "offer-sdp", mid: "0" });
    expect((await vs.next("voiceSdp")).sdp).toEqual({ type: "answer", sdp: "answer-sdp" });
    const { members } = await vs.next("voice", (m) => m.members.length === 1);
    expect(members[0]).toMatchObject({ id: 2202, name: "User2202" });
    expect(rt.calls.map((c) => c.path)).toContain("/sessions/new");

    await press(2201, button(2201, "Bắt đầu"));
    const word = /Từ của bạn: <b>(.+?)<\/b>/.exec(
      tg
        .to(2202)
        .map((m) => m.text)
        .join("\n"),
    )?.[1];
    await new Promise((r) => setTimeout(r, 100));
    expect(vs.messages.every((m) => m.type.startsWith("voice"))).toBe(true);
    if (word) expect(JSON.stringify(vs.messages)).not.toContain(word);

    // The voice page cannot play: commands are refused.
    vs.send({ type: "command", action: "openVote", gameId: 1, round: 1 });
    expect(await vs.next("error")).toEqual({ type: "error", code: "bad_request" });
  });

  it("V4 AC10 a bad login, a web session or a player outside the room gets no call", async () => {
    const code = await openRoom([2301, 2302, 2303]);
    const forged = await telegramLogin(2302, code);
    forged.set("id", "2399");
    const res = await api(`/api/voice/login?${forged}`, { redirect: "manual" });
    expect(res.headers.get("location")).toBe(`/v/${code}?login=failed`);
    expect(res.headers.get("set-cookie")).toBeNull();

    const web = await guest("Lan");
    expect((await api(`/api/voice/${code}`, { cookie: web.cookie })).status).toBe(401);

    const outsider = await login(2399, code);
    expect(await (await api(`/api/voice/${code}`, { cookie: outsider })).json()).toEqual({ id: 2399, inRoom: false });
    const ws = await SELF.fetch(`https://a3spy.test/api/voice/${code}/ws`, {
      headers: { cookie: outsider, upgrade: "websocket" },
    });
    expect(ws.status).toBe(403);
  });

  it("V4 AC10 the voice link stops working once the player leaves the room", async () => {
    const code = await openRoom([2401, 2402, 2403]);
    await press(2401, button(2401, "Chơi online"));
    const cookie = await login(2402, code);
    const vs = await voiceSocket(cookie, code);
    await vs.next("voice");
    await text(2402, "/leave");
    expect((await vs.closed).code).toBe(4000);
    expect(await (await api(`/api/voice/${code}`, { cookie })).json()).toEqual({ id: 2402, inRoom: false });
  });
});
