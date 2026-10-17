import { afterEach, describe, expect, it, vi } from "vitest";
import { configure, leave, type Room } from "../../src/game/engine";
import { PACKS } from "../../src/game/words";
import { realtime } from "../../src/voice/realtime";
import { dropConn, members, prune, pullable, type Roster } from "../../src/voice/roster";
import { parseMessage } from "../../src/web/protocol";
import { expectOk, lobby } from "../helpers/game";

const THEMES = PACKS.map((p) => p.id);
const voiceOn = (room: Room) => expectOk(configure(room, room.hostId, { kind: "voice" }, THEMES)).room;
const seat = (n: number, extra = {}) => ({
  sessionId: `s${n}`,
  track: `p${n}-x`,
  muted: false,
  conn: `c${n}`,
  ...extra,
});

describe("V2 V3 voice roster", () => {
  it("V3 AC13 members carry names, mute state and a key per join; never session ids", () => {
    const room = voiceOn(lobby(3));
    const roster: Roster = { 1: seat(1), 2: seat(2, { muted: true }) };
    const list = members(room, roster);
    expect(list).toEqual([
      { id: 1, name: room.players[0]?.name, muted: false, key: "p1-x" },
      { id: 2, name: room.players[1]?.name, muted: true, key: "p2-x" },
    ]);
    expect(JSON.stringify(list)).not.toContain("s1");
  });

  it("V1 AC4 turning voice off empties the call", () => {
    const room = voiceOn(lobby(3));
    const off = expectOk(configure(room, 1, { kind: "voice" }, THEMES)).room;
    expect(prune(off, { 1: seat(1) })).toEqual({});
    expect(members(off, { 1: seat(1) })).toEqual([]);
  });

  it("V5 AC21 a player who leaves the room leaves the call", () => {
    const room = expectOk(leave(voiceOn(lobby(4)), 2)).room;
    expect(Object.keys(prune(room, { 1: seat(1), 2: seat(2) }))).toEqual(["1"]);
  });

  it("V2 AC11 a device pulls only other seats that are in the call", () => {
    const roster: Roster = { 1: seat(1), 2: seat(2) };
    expect(pullable(roster, 1, [1, 2, 2, 9]).map((x) => x.id)).toEqual([2]);
  });

  it("V5 a closed socket removes only the seat it opened", () => {
    expect(Object.keys(dropConn({ 1: seat(1), 2: seat(2) }, "c2"))).toEqual(["1"]);
  });
});

describe("voice messages from the web", () => {
  it("accepts well-formed voice ops and rejects the rest", () => {
    expect(parseMessage('{"type":"voice","op":"join","sdp":"v=0","mid":"0"}')).toEqual({
      type: "voice",
      op: "join",
      sdp: "v=0",
      mid: "0",
    });
    expect(parseMessage('{"type":"voice","op":"pull","ids":[-5,7]}')).toEqual({
      type: "voice",
      op: "pull",
      ids: [-5, 7],
    });
    expect(parseMessage('{"type":"voice","op":"mute","muted":true}')).toEqual({
      type: "voice",
      op: "mute",
      muted: true,
    });
    expect(parseMessage('{"type":"command","action":"start"}')).toEqual({ type: "command", cmd: { action: "start" } });
    for (const bad of [
      '{"type":"voice","op":"join","sdp":"","mid":"0"}',
      `{"type":"voice","op":"answer","sdp":"${"x".repeat(32_001)}"}`,
      '{"type":"voice","op":"pull","ids":[]}',
      '{"type":"voice","op":"pull","ids":["1"]}',
      '{"type":"voice","op":"mute","muted":"yes"}',
      '{"type":"voice","op":"record"}',
    ])
      expect(parseMessage(bad)).toBeNull();
  });
});

describe("Realtime API client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("is off without an app token", () => {
    expect(realtime({ REALTIME_APP_ID: "app" })).toBeNull();
  });

  it("creates a session, pushes with the offer, pulls and renegotiates with the app token", async () => {
    const calls: { url: string; method: string; auth: string | null; body: unknown }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method: init?.method ?? "GET", auth: new Headers(init?.headers).get("authorization"), body });
      if (url.endsWith("/sessions/new")) return Response.json({ sessionId: "S1" });
      if (url.endsWith("/renegotiate")) return Response.json({});
      if (body?.tracks?.[0]?.location === "local")
        return Response.json({
          sessionDescription: { type: "answer", sdp: "A" },
          tracks: [{ trackName: "t", mid: "0" }],
        });
      return Response.json({
        requiresImmediateRenegotiation: true,
        sessionDescription: { type: "offer", sdp: "O" },
        tracks: [
          { trackName: "p2", mid: "1" },
          { trackName: "p3", errorCode: "not_found" },
        ],
      });
    });
    const rt = realtime({ REALTIME_APP_ID: "app", REALTIME_APP_TOKEN: "tok" });
    if (!rt) throw new Error("expected a client");
    expect(await rt.newSession()).toBe("S1");
    expect(await rt.push("S1", { type: "offer", sdp: "o" }, "0", "t")).toEqual({ type: "answer", sdp: "A" });
    expect(
      await rt.pull("S1", [
        { sessionId: "S2", trackName: "p2" },
        { sessionId: "S3", trackName: "p3" },
      ]),
    ).toEqual({ offer: { type: "offer", sdp: "O" }, mids: { p2: "1" } });
    await rt.renegotiate("S1", { type: "answer", sdp: "a" });

    expect(calls.map((c) => `${c.method} ${c.url.replace("https://rtc.live.cloudflare.com/v1", "")}`)).toEqual([
      "POST /apps/app/sessions/new",
      "POST /apps/app/sessions/S1/tracks/new",
      "POST /apps/app/sessions/S1/tracks/new",
      "PUT /apps/app/sessions/S1/renegotiate",
    ]);
    expect(calls.every((c) => c.auth === "Bearer tok")).toBe(true);
    expect(calls[1]?.body).toEqual({
      sessionDescription: { type: "offer", sdp: "o" },
      tracks: [{ location: "local", mid: "0", trackName: "t" }],
    });
    expect(calls[2]?.body).toEqual({
      tracks: [
        { location: "remote", sessionId: "S2", trackName: "p2" },
        { location: "remote", sessionId: "S3", trackName: "p3" },
      ],
    });
  });

  it("turns API errors into exceptions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ errorCode: "bad", errorDescription: "x" }));
    const rt = realtime({ REALTIME_APP_ID: "app", REALTIME_APP_TOKEN: "tok" });
    await expect(rt?.newSession()).rejects.toThrow(/bad/);
  });
});
