import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomView } from "../../src/game/view";
import { telegramStub } from "../helpers/telegram";
import { api, connect, createRoom, guest, joinRoom, type Socket, type WebPlayer } from "../helpers/web";

let tg: ReturnType<typeof telegramStub>;

beforeEach(() => {
  tg = telegramStub();
});
afterEach(() => {
  vi.restoreAllMocks();
});

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
  it("W2 AC3 X4 AC13 a guest opens a room and is its host; links point to the web only", async () => {
    const host = await guest("Host");
    const code = await createRoom(host);
    expect(code).toMatch(/^[A-Z0-9]{4}$/);
    const sock = await connect(host, code);
    const state = await sock.next("state");
    expect(state.view).toMatchObject({ code, me: host.id, hostId: host.id, players: [{ id: host.id, name: "Host" }] });
    expect(state.links).toEqual({ web: `https://a3spy.test/r/${code}` });
    // Rooms never call Telegram.
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

  it("W1 AC6 every lobby updates when someone joins or leaves", async () => {
    const host = await guest("Host");
    const code = await createRoom(host);
    const sock = await connect(host, code);
    await sock.next("state");

    const p = await guest("Lan");
    await joinRoom(p, code);
    expect((await sock.next("state")).view.players.map((x) => x.name)).toEqual(["Host", "Lan"]);
    const q = await guest("Minh");
    await joinRoom(q, code);
    expect((await sock.next("state")).view.players.map((x) => x.name)).toEqual(["Host", "Lan", "Minh"]);

    await api(`/api/rooms/${code}/leave`, { method: "POST", cookie: p.cookie });
    expect((await sock.next("state")).view.players.map((x) => x.name)).toEqual(["Host", "Minh"]);
    const me = await (await api("/api/me", { cookie: p.cookie })).json<{ room: string | null }>();
    expect(me.room).toBeNull();
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

describe("a game over sockets", () => {
  /** A web host and `n - 1` web guests in one room, all connected. */
  async function webRoom(n: number) {
    const players = [await guest("Host")];
    for (let i = 1; i < n; i++) players.push(await guest(`P${i}`));
    const code = await createRoom(players[0] as WebPlayer);
    for (const p of players.slice(1)) await joinRoom(p, code);
    const socks: Socket[] = [];
    for (const p of players) {
      const s = await connect(p, code);
      await s.next("state", (m) => m.view.players.length === n);
      socks.push(s);
    }
    return { code, players, socks, host: socks[0] as Socket };
  }
  const turn = (view: RoomView) => ({ gameId: view.game?.id ?? 0, round: view.game?.round ?? 0 });

  it("W3 W4 W5 each player gets their own word, votes, and everyone sees the same result", async () => {
    const { players, socks, host } = await webRoom(4);
    const [sa, sb] = socks as [Socket, Socket];
    host.send({ type: "command", action: "start" });

    const stateA = await sa.next("state", (m) => m.view.game !== null);
    const stateB = await sb.next("state", (m) => m.view.game !== null);
    expect(stateA.view.game?.hand).not.toBeNull();
    const wordB = stateB.view.game?.hand?.word;
    if (wordB && wordB !== stateA.view.game?.hand?.word) expect(JSON.stringify(sa.messages)).not.toContain(wordB);
    // game_started reached the web without the hands.
    const started = sa.messages.find((m) => m.type === "events");
    expect(JSON.stringify(started)).not.toContain('"hands"');

    host.send({ type: "command", action: "openVote", ...turn(stateA.view) });
    const voting = await sa.next("state", (m) => m.view.game?.phase === "voting");
    const target = (players[3] as WebPlayer).id;
    expect(voting.view.game?.canVoteFor).not.toContain((players[0] as WebPlayer).id);

    for (const s of socks.slice(0, 3)) s.send({ type: "command", action: "vote", ...turn(voting.view), target });
    socks[3]?.send({ type: "command", action: "vote", ...turn(voting.view), target: (players[0] as WebPlayer).id });

    const results = await Promise.all(
      socks.map((s) => s.next("events", (m) => m.events.some((e) => e.type === "eliminated"))),
    );
    for (const r of results)
      expect(r.events).toContainEqual(expect.objectContaining({ type: "eliminated", playerId: target }));
    expect(results[0]?.events.find((e) => e.type === "vote_closed")).toMatchObject({ tally: { [target]: 3 } });
  });

  it("S2 a game won on the web is counted in the leaderboard", async () => {
    const { players, socks, host } = await webRoom(3);
    host.send({ type: "command", action: "start" });
    const views = await Promise.all(socks.map((s) => s.next("state", (m) => m.view.game !== null)));
    // With 3 players there is one spy and no Mr. White: the spy holds the odd word.
    const words = views.map((v) => v.view.game?.hand?.word);
    const spyAt = words.findIndex((w) => words.filter((x) => x === w).length === 1);
    const spy = (players[spyAt] as WebPlayer).id;

    host.send({ type: "command", action: "openVote", ...turn(views[0]?.view as RoomView) });
    const voting = await host.next("state", (m) => m.view.game?.phase === "voting");
    socks.forEach((s, i) => {
      const target = i === spyAt ? (players[(i + 1) % 3] as WebPlayer).id : spy;
      s.send({ type: "command", action: "vote", ...turn(voting.view), target });
    });
    await host.next("state", (m) => m.view.game?.phase === "ended");

    const { board } = await (await api("/api/stats", { cookie: (players[0] as WebPlayer).cookie })).json<{
      board: { id: number; wins: number }[];
    }>();
    const winners = players.filter((_, i) => i !== spyAt).map((p) => p.id);
    for (const id of winners) expect(board.find((b) => b.id === id)?.wins).toBeGreaterThanOrEqual(1);
  });

  it("G5 AC3 AC6 a due discussion timer shows on every screen and changes nothing else", async () => {
    const { env, runInDurableObject, runDurableObjectAlarm } = await import("cloudflare:test");
    const { code, socks, host } = await webRoom(3);
    host.send({ type: "command", action: "configure", change: { kind: "timer", timer: "discussion" } });
    await host.next("state", (m) => m.view.settings.timers.discussion === 2);
    host.send({ type: "command", action: "start" });
    const started = await host.next("state", (m) => m.view.game?.timer?.kind === "discussion");

    const stub = env.GAME_ROOM.getByName(code);
    // Move the deadline into the past instead of waiting two minutes.
    await runInDurableObject(stub, (_, state) => {
      const stored = state.storage.kv.get<{ timer: { endsAt: number } }>("state");
      if (!stored?.timer) throw new Error("no timer stored");
      stored.timer.endsAt = 0;
      state.storage.kv.put("state", stored);
    });
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    for (const s of socks) {
      const after = await s.next("state", (m) => m.view.game?.timer?.endsAt === 0);
      expect(after.view.game?.phase).toBe("describing");
      expect(after.view.game?.round).toBe(started.view.game?.round);
    }
  });

  it("an idle room closes, and its players are free to join another", async () => {
    const { env, runInDurableObject, runDurableObjectAlarm } = await import("cloudflare:test");
    const { code, players, host } = await webRoom(3);
    const stub = env.GAME_ROOM.getByName(code);
    await runInDurableObject(stub, (_, state) => {
      const stored = state.storage.kv.get<{ updatedAt: number }>("state");
      if (!stored) throw new Error("no room");
      stored.updatedAt = 0;
      state.storage.kv.put("state", stored);
    });
    await runDurableObjectAlarm(stub);
    expect(await host.closed).toEqual({ code: 4001 });
    for (const p of players) {
      const me = await (await api("/api/me", { cookie: p.cookie })).json<{ room: string | null }>();
      expect(me.room).toBeNull();
    }
  });

  it("W5 AC16 a stale command gets an error and a fresh state", async () => {
    const { socks, host } = await webRoom(3);
    const sa = socks[1] as Socket;
    host.send({ type: "command", action: "start" });
    const { view } = await sa.next("state", (m) => m.view.game !== null);
    sa.send({ type: "command", action: "vote", gameId: view.game?.id, round: (view.game?.round ?? 0) + 1, target: 1 });
    expect(await sa.next("error")).toEqual({ type: "error", code: "stale" });
    await sa.next("state");
  });

  it("W5 only the host advances phases", async () => {
    const { socks } = await webRoom(3);
    socks[1]?.send({ type: "command", action: "start" });
    expect(await socks[1]?.next("error")).toEqual({ type: "error", code: "not_host" });
  });

  it("rejects malformed messages", async () => {
    const { host } = await webRoom(3);
    host.ws.send("not json");
    expect(await host.next("error")).toEqual({ type: "error", code: "bad_request" });
    host.send({ type: "command", action: "vote", gameId: "1" });
    expect(await host.next("error")).toEqual({ type: "error", code: "bad_request" });
  });

  it("W8 AC20 reconnecting takes the seat over and gets the current state at once", async () => {
    const { code, players, socks, host } = await webRoom(3);
    const sa = socks[1] as Socket;
    host.send({ type: "command", action: "start" });
    const before = await sa.next("state", (m) => m.view.game !== null);
    const again = await connect(players[1] as WebPlayer, code);
    const after = await again.next("state");
    expect(after.view.game?.hand).toEqual(before.view.game?.hand);
    expect(await sa.closed).toEqual({ code: 4002 });
    expect(sa.messages.at(-1)).toEqual({ type: "closed", reason: "replaced" });
  });

  it("W5 leaving over the socket closes it and tells the others", async () => {
    const { players, socks, host } = await webRoom(3);
    const leaver = (players[1] as WebPlayer).id;
    socks[1]?.send({ type: "command", action: "leave" });
    expect(await socks[1]?.closed).toEqual({ code: 4000 });
    const state = await host.next("state", (m) => !m.view.players.some((p) => p.id === leaver));
    expect(state.view.players).toHaveLength(2);
  });
});

describe("host settings over the web", () => {
  it("L4 AC2 the host changes settings over the socket; others see it; non-hosts cannot", async () => {
    const host = await guest("Host");
    const code = await createRoom(host);
    const p = await guest("Lan");
    await joinRoom(p, code);
    const sh = await connect(host, code);
    const sp = await connect(p, code);
    await sh.next("state");
    await sp.next("state");

    sh.send({ type: "command", action: "configure", change: { kind: "theme", theme: "food" } });
    const seen = await sp.next("state", (m) => m.view.settings.themes.some((t) => !t.on));
    expect(seen.view.settings.themes.find((t) => t.id === "food")?.on).toBe(false);

    sp.send({ type: "command", action: "configure", change: { kind: "white" } });
    expect(await sp.next("error")).toEqual({ type: "error", code: "not_host" });

    sh.send({ type: "command", action: "configure", change: { kind: "spies", delta: 2 } });
    expect(await sh.next("error")).toEqual({ type: "error", code: "bad_request" });
  });
});

describe("long-term stats on the web", () => {
  it("S2 AC5 AC6 a guest gets their stats and the leaderboard", async () => {
    const g = await guest("Stat");
    const res = await api("/api/stats", { cookie: g.cookie });
    expect(res.status).toBe(200);
    const body = await res.json<{ me: unknown; board: unknown[] }>();
    expect(body.me).toBeNull();
    expect(Array.isArray(body.board)).toBe(true);
    expect((await api("/api/stats")).status).toBe(401);
  });
});
