import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { press, telegramStub, text } from "../helpers/telegram";
import { api, connect, createRoom, guest, joinRoom } from "../helpers/web";

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

describe("sessions", () => {
  it("W1 AC1 a name creates a guest with a negative ID and an HttpOnly cookie", async () => {
    const res = await api("/api/session", { method: "POST", body: JSON.stringify({ name: "  Lan   Anh " }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/a3spy_session=-\d+\.[0-9a-f]{64}; .*HttpOnly; Secure; SameSite=Lax/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json<{ id: number; name: string }>();
    expect(body.id).toBeLessThan(0);
    expect(body.name).toBe("Lan Anh");
  });

  it("W1 AC2 empty, blank or too long names are refused", async () => {
    for (const name of ["", "   ", "x".repeat(25), 42]) {
      const res = await api("/api/session", { method: "POST", body: JSON.stringify({ name }) });
      expect(res.status).toBe(400);
    }
  });

  it("W8 a returning guest keeps their ID; renaming keeps it too", async () => {
    const g = await guest("Minh");
    const me = await (await api("/api/me", { cookie: g.cookie })).json<{ id: number; name: string; room: null }>();
    expect(me).toEqual({ id: g.id, name: "Minh", room: null });
    const renamed = await api("/api/session", {
      method: "POST",
      cookie: g.cookie,
      body: JSON.stringify({ name: "Minh béo" }),
    });
    expect(await renamed.json()).toEqual({ id: g.id, name: "Minh béo" });
    expect(renamed.headers.get("set-cookie")).toBeNull();
  });

  it("rejects requests without a valid session", async () => {
    expect((await api("/api/me")).status).toBe(401);
    const forged = `a3spy_session=-12345.${"0".repeat(64)}`;
    expect((await api("/api/me", { cookie: forged })).status).toBe(401);
    expect((await api("/api/rooms", { method: "POST" })).status).toBe(401);
  });
});

describe("rooms over the web API", () => {
  it("W2 AC3 a guest opens a room and is its host", async () => {
    const host = await guest("Host");
    const code = await createRoom(host);
    expect(code).toMatch(/^[A-Z0-9]{4}$/);
    const sock = await connect(host, code);
    const state = await sock.next("state");
    expect(state.view).toMatchObject({ code, me: host.id, hostId: host.id, players: [{ id: host.id, name: "Host" }] });
    expect(state.links.web).toBe(`https://a3spy.test/r/${code}`);
    expect(state.links.telegram).toBe(`https://t.me/a3spy_bot?start=${code}`);
    // Web players never trigger Telegram calls.
    expect(tg.calls).toHaveLength(0);
  });

  it("W1 AC4 joining an unknown code fails; a lowercase code works", async () => {
    const host = await guest("Host");
    const code = await createRoom(host);
    const p = await guest("Lan");
    expect((await joinRoom(p, "ZZZZ")).status).toBe(404);
    expect((await joinRoom(p, code.toLowerCase())).status).toBe(200);
    expect((await joinRoom(p, code)).status).toBe(200);
    const me = await (await api("/api/me", { cookie: p.cookie })).json<{ room: string }>();
    expect(me.room).toBe(code);
  });

  it("W1 AC5 a guest in one room cannot join or open another", async () => {
    const a = await guest("A");
    const b = await guest("B");
    const first = await createRoom(a);
    const second = await createRoom(b);
    const res = await joinRoom(a, second);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "in_other_room", room: first });
    expect((await api("/api/rooms", { method: "POST", cookie: a.cookie })).status).toBe(409);
  });

  it("W1 AC6 every web lobby updates when someone joins or leaves, on either client", async () => {
    const host = await guest("Host");
    const code = await createRoom(host);
    const sock = await connect(host, code);
    await sock.next("state");

    const p = await guest("Lan");
    await joinRoom(p, code);
    expect((await sock.next("state")).view.players.map((x) => x.name)).toEqual(["Host", "Lan"]);

    await text(301, `/join ${code}`);
    expect((await sock.next("state")).view.players.map((x) => x.name)).toEqual(["Host", "Lan", "User301"]);
    // The Telegram player sees web players and the web link in their lobby (AC18).
    expect(tg.last(301)?.text).toContain("Lan");
    expect(tg.last(301)?.text).toContain(`https://a3spy.test/r/${code}`);

    await api(`/api/rooms/${code}/leave`, { method: "POST", cookie: p.cookie });
    expect((await sock.next("state")).view.players.map((x) => x.name)).toEqual(["Host", "User301"]);
  });

  it("refuses a socket for a room the guest is not in", async () => {
    const host = await guest("Host");
    const code = await createRoom(host);
    const other = await guest("Other");
    const res = await api(`/api/rooms/${code}/ws`, { cookie: other.cookie, headers: { upgrade: "websocket" } });
    expect(res.status).toBe(403);
    expect(res.webSocket).toBeNull();
  });
});

describe("a mixed game over sockets", () => {
  /** Telegram host `t` opens the room; two web guests and Telegram player `t + 1` join. Storage is shared across tests. */
  async function mixedRoom(t: number) {
    await text(t, "/newgame");
    const code = /Phòng (\w{4})/.exec(tg.last(t)?.text ?? "")?.[1] as string;
    await text(t + 1, `/start ${code}`);
    const a = await guest("Web A");
    const b = await guest("Web B");
    await joinRoom(a, code);
    await joinRoom(b, code);
    const sa = await connect(a, code);
    const sb = await connect(b, code);
    await sa.next("state");
    await sb.next("state");
    return { code, a, b, sa, sb };
  }

  it("W3 W4 W5 W7 web players get their own word, vote, and see the same result as Telegram", async () => {
    const { a, b, sa, sb } = await mixedRoom(500);
    await press(500, button(500, "Bắt đầu"));

    const stateA = await sa.next("state", (m) => m.view.game !== null);
    const stateB = await sb.next("state", (m) => m.view.game !== null);
    // Each web player has a hand; neither sees the other's word.
    expect(stateA.view.game?.hand).not.toBeNull();
    const wordB = stateB.view.game?.hand?.word;
    if (wordB && wordB !== stateA.view.game?.hand?.word) expect(JSON.stringify(sa.messages)).not.toContain(wordB);
    // game_started reached the web without the hands.
    const started = sa.messages.find((m) => m.type === "events");
    expect(JSON.stringify(started)).not.toContain('"hands"');

    await press(500, button(500, "Mở vote"));
    const voting = await sa.next("state", (m) => m.view.game?.phase === "voting");
    const game = voting.view.game as NonNullable<typeof voting.view.game>;
    expect(game.canVoteFor).not.toContain(a.id);

    // Everyone votes for 501; 501 votes for web A.
    sa.send({ type: "command", action: "vote", gameId: game.id, round: game.round, target: 501 });
    const afterVote = await sa.next("state", (m) => m.view.game?.myVote === 501);
    expect(afterVote.view.game?.votes.count).toBe(1);
    sb.send({ type: "command", action: "vote", gameId: game.id, round: game.round, target: 501 });
    await press(501, button(501, "Web A"));
    await press(500, button(500, "User501"));

    const result = await sb.next("events", (m) => m.events.some((e) => e.type === "eliminated"));
    expect(result.events).toContainEqual(expect.objectContaining({ type: "eliminated", playerId: 501 }));
    expect(result.events.find((e) => e.type === "vote_closed")).toMatchObject({ tally: { 501: 3, [a.id]: 1 } });
    // Telegram players got the same result.
    expect(tg.last(500)?.text).toContain("User501 bị loại");
    void b;
  });

  it("W5 AC16 a stale command gets an error and a fresh state", async () => {
    const { sa } = await mixedRoom(600);
    await press(600, button(600, "Bắt đầu"));
    const { view } = await sa.next("state", (m) => m.view.game !== null);
    const game = view.game as NonNullable<typeof view.game>;
    sa.send({ type: "command", action: "vote", gameId: game.id, round: game.round + 1, target: 600 });
    expect(await sa.next("error")).toEqual({ type: "error", code: "stale" });
    await sa.next("state");
  });

  it("W5 only the host advances phases", async () => {
    const { sa } = await mixedRoom(700);
    sa.send({ type: "command", action: "start" });
    expect(await sa.next("error")).toEqual({ type: "error", code: "not_host" });
  });

  it("rejects malformed messages", async () => {
    const { sa } = await mixedRoom(800);
    sa.ws.send("not json");
    expect(await sa.next("error")).toEqual({ type: "error", code: "bad_request" });
    sa.send({ type: "command", action: "vote", gameId: "1" });
    expect(await sa.next("error")).toEqual({ type: "error", code: "bad_request" });
  });

  it("W8 AC20 reconnecting takes the seat over and gets the current state at once", async () => {
    const { code, a, sa } = await mixedRoom(900);
    await press(900, button(900, "Bắt đầu"));
    const before = await sa.next("state", (m) => m.view.game !== null);
    const again = await connect(a, code);
    const after = await again.next("state");
    expect(after.view.game?.hand).toEqual(before.view.game?.hand);
    expect(await sa.closed).toEqual({ code: 4002 });
    expect(sa.messages.at(-1)).toEqual({ type: "closed", reason: "replaced" });
  });

  it("W5 leaving over the socket closes it and tells the others", async () => {
    const { sa, sb, a } = await mixedRoom(1000);
    sa.send({ type: "command", action: "leave" });
    expect(await sa.closed).toEqual({ code: 4000 });
    const state = await sb.next("state", (m) => !m.view.players.some((p) => p.id === a.id));
    expect(state.view.players).toHaveLength(3);
  });
});
