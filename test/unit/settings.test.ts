import { describe, expect, it } from "vitest";
import {
  configure,
  createRoom,
  end,
  join,
  leave,
  pairKey,
  type Room,
  type SettingsChange,
  start,
} from "../../src/game/engine";
import { seededRng } from "../../src/game/rng";
import { settingsView } from "../../src/game/view";
import { PACKS } from "../../src/game/words";
import { decide } from "../../src/room/commands";
import { parseClientMessage } from "../../src/web/protocol";
import { expectOk, lobby, PAIRS, player } from "../helpers/game";

const THEMES = PACKS.map((p) => p.id);
const set = (room: Room, ...changes: SettingsChange[]) =>
  changes.reduce((r, c) => expectOk(configure(r, r.hostId, c, THEMES)).room, room);
const opts = (seed = 1, now = 0) => ({ rng: seededRng(seed), pairs: PAIRS, now });

describe("L4 host settings", () => {
  it("L4 AC1 a new room uses every theme and the role table", () => {
    const view = settingsView(lobby(6));
    expect(view).toMatchObject({ auto: true, spies: 1, white: 1, problem: null });
    expect(view.themes.every((t) => t.on)).toBe(true);
    expect(settingsView(lobby(2))).toMatchObject({ spies: null, white: null, problem: "too_few_players" });
  });

  it("L4 AC2 only the host can change settings, and every change is announced", () => {
    const room = lobby(5);
    expect(configure(room, 2, { kind: "white" }, THEMES)).toEqual({ ok: false, error: "not_host" });
    const r = expectOk(configure(room, 1, { kind: "white" }, THEMES));
    expect(r.events).toEqual([{ type: "settings_changed", settings: r.room.settings }]);
    expect(settingsView(r.room)).toMatchObject({ auto: false, spies: 1, white: 0 });
  });

  it("L4 AC3 a start that leaves civilians without a majority is refused", () => {
    const room = set(lobby(5), { kind: "spies", delta: 1 });
    expect(settingsView(room)).toMatchObject({ spies: 2, white: 1, problem: "civilians_not_majority" });
    expect(start(room, 1, opts())).toEqual({ ok: false, error: "bad_counts" });
    // Turning Mr. White off fixes it: 2 spies, 3 civilians.
    const fixed = set(room, { kind: "white" });
    const game = expectOk(start(fixed, 1, opts())).room.game;
    expect(game?.hands.filter((h) => h.role === "spy")).toHaveLength(2);
    expect(game?.hands.filter((h) => h.role === "white")).toHaveLength(0);
  });

  it("L4 AC4 play again keeps the settings", () => {
    let room = set(lobby(7), { kind: "white" }, { kind: "spies", delta: -1 });
    room = expectOk(start(room, 1, opts())).room;
    room = expectOk(end(room, 1)).room;
    const again = expectOk(start(room, 1, opts(2))).room;
    expect(again.game?.hands.filter((h) => h.role === "spy")).toHaveLength(1);
    expect(again.game?.hands.filter((h) => h.role === "white")).toHaveLength(0);
  });

  it("L4 AC5 counts follow the table until the host touches them, then stay", () => {
    let room = lobby(4);
    expect(settingsView(room)).toMatchObject({ spies: 1, white: 0 });
    room = expectOk(join(room, player(5))).room;
    expect(settingsView(room)).toMatchObject({ spies: 1, white: 1, auto: true });
    room = set(room, { kind: "spies", delta: 1 }, { kind: "white" });
    expect(settingsView(room)).toMatchObject({ spies: 2, white: 0, auto: false });
    for (const id of [6, 7, 8]) room = expectOk(join(room, player(id))).room;
    expect(settingsView(room)).toMatchObject({ spies: 2, white: 0 });
    room = set(room, { kind: "auto" });
    expect(settingsView(room)).toMatchObject({ spies: 2, white: 1, auto: true });
  });

  it("L4 spies stay between 1 and 5", () => {
    const low = set(
      lobby(12),
      { kind: "spies", delta: -1 },
      { kind: "spies", delta: -1 },
      { kind: "spies", delta: -1 },
    );
    expect(settingsView(low).spies).toBe(1);
    const high = set(lobby(12), ...Array.from({ length: 5 }, () => ({ kind: "spies", delta: 1 }) as const));
    expect(settingsView(high).spies).toBe(5);
  });

  it("L4 themes toggle; all on means every theme; the last one cannot be turned off", () => {
    const [a, b, ...rest] = THEMES as [string, string, ...string[]];
    let room = set(lobby(3), { kind: "theme", theme: a });
    expect(room.settings.themes).toEqual([b, ...rest]);
    room = set(room, { kind: "theme", theme: a });
    expect(room.settings.themes).toEqual([]);
    for (const t of [b, ...rest]) room = set(room, { kind: "theme", theme: t });
    expect(room.settings.themes).toEqual([a]);
    expect(configure(room, 1, { kind: "theme", theme: a }, THEMES)).toEqual({ ok: false, error: "bad_setting" });
    expect(configure(room, 1, { kind: "theme", theme: "nope" }, THEMES)).toEqual({ ok: false, error: "bad_setting" });
    expect(set(room, { kind: "allThemes" }).settings.themes).toEqual([]);
  });

  it("L4 settings cannot change while a game is running", () => {
    const room = expectOk(start(lobby(4), 1, opts())).room;
    expect(configure(room, 1, { kind: "white" }, THEMES)).toEqual({ ok: false, error: "game_running" });
  });

  it("L4 the new host keeps the settings when the host leaves", () => {
    const room = set(lobby(5), { kind: "white" });
    const after = expectOk(leave(room, 1)).room;
    expect(after.hostId).toBe(2);
    expect(after.settings).toEqual(room.settings);
  });

  it("L4 a game draws only from the chosen themes", () => {
    const food = PACKS.find((p) => p.id === "food");
    let room = createRoom("ABCD", player(1));
    for (const id of [2, 3]) room = expectOk(join(room, player(id))).room;
    for (const t of THEMES.filter((t) => t !== "food")) room = set(room, { kind: "theme", theme: t });
    const deps = {
      rng: seededRng(3),
      themes: THEMES,
      now: 0,
      pairs: (themes: readonly string[]) => PACKS.filter((p) => themes.includes(p.id)).flatMap((p) => p.pairs),
    };
    const game = expectOk(decide(room, 1, { action: "start" }, deps)).room.game;
    const keys = new Set(food?.pairs.map(pairKey));
    expect(keys.has(pairKey({ a: game?.civilianWord as string, b: game?.spyWord as string }))).toBe(true);
  });

  it("L4 when every pair was played recently, the one played longest ago comes back", () => {
    const room: Room = {
      ...lobby(3),
      recentPairs: [
        { key: pairKey(PAIRS[0] as (typeof PAIRS)[0]), at: 1000 },
        { key: pairKey(PAIRS[1] as (typeof PAIRS)[1]), at: 500 },
      ],
    };
    for (let seed = 1; seed <= 10; seed++) {
      const game = expectOk(start(room, 1, opts(seed, 2000))).room.game;
      expect(pairKey({ a: game?.civilianWord as string, b: game?.spyWord as string })).toBe(
        pairKey(PAIRS[1] as (typeof PAIRS)[1]),
      );
    }
  });
});

describe("V1 Chơi online", () => {
  it("U1 AC1 a new room is online (voice on)", () => {
    expect(settingsView(lobby(4)).voice).toBe(true);
  });

  it("V1 AC2 only the host turns voice on and off, and every change is announced", () => {
    const room = lobby(4);
    expect(configure(room, 2, { kind: "voice" }, THEMES)).toEqual({ ok: false, error: "not_host" });
    const off = expectOk(configure(room, 1, { kind: "voice" }, THEMES));
    expect(off.events).toEqual([{ type: "settings_changed", settings: off.room.settings }]);
    expect(settingsView(off.room).voice).toBe(false);
    expect(settingsView(set(off.room, { kind: "voice" })).voice).toBe(true);
  });

  it("V1 AC3 voice cannot change while a game is running", () => {
    const room = expectOk(start(set(lobby(4), { kind: "voice" }), 1, opts())).room;
    expect(configure(room, 1, { kind: "voice" }, THEMES)).toEqual({ ok: false, error: "game_running" });
  });

  it("V1 AC5 voice survives play again and a change of host", () => {
    let room = set(lobby(4), { kind: "voice" });
    room = expectOk(start(room, 1, opts())).room;
    room = expectOk(end(room, 1)).room;
    room = expectOk(start(room, 1, opts(2))).room;
    expect(room.settings.voice).toBe(false);
    room = expectOk(end(room, 1)).room;
    expect(expectOk(leave(room, 1)).room.settings.voice).toBe(false);
  });

  it("V1 the web sends the voice toggle as a settings change", () => {
    expect(parseClientMessage('{"type":"command","action":"configure","change":{"kind":"voice"}}')).toEqual({
      action: "configure",
      change: { kind: "voice" },
    });
  });
});
