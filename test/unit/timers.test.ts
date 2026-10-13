import { describe, expect, it } from "vitest";
import { decodeChange, encodeChange } from "../../src/bot/callbacks";
import { closeVote, configure, openVote, type Room, type SettingsChange, vote } from "../../src/game/engine";
import { isDue, nextTimer } from "../../src/game/timers";
import { settingsView, viewFor } from "../../src/game/view";
import { PACKS } from "../../src/game/words";
import { expectOk, lobby, started, turnOf } from "../helpers/game";

const THEMES = PACKS.map((p) => p.id);
const set = (room: Room, ...changes: SettingsChange[]) =>
  changes.reduce((r, c) => expectOk(configure(r, r.hostId, c, THEMES)).room, room);
const withTimers = (room: Room, discussion: number, vote: number): Room => ({
  ...room,
  settings: { ...room.settings, timers: { discussion, vote } },
});
const MIN = 60_000;

describe("G5 timers", () => {
  it("G5 AC1 both timers are off in a new room", () => {
    expect(settingsView(lobby(3)).timers).toEqual({ discussion: 0, vote: 0 });
    expect(nextTimer(started(4), null, 0)).toBeNull();
  });

  it("G5 AC2 the host cycles each timer through its durations", () => {
    const seen: number[] = [];
    let room = lobby(4);
    for (let i = 0; i < 4; i++) {
      room = set(room, { kind: "timer", timer: "discussion" });
      seen.push(room.settings.timers.discussion);
    }
    expect(seen).toEqual([2, 3, 5, 0]);
    room = set(room, { kind: "timer", timer: "vote" }, { kind: "timer", timer: "vote" });
    expect(room.settings.timers.vote).toBe(2);
    expect(configure(room, 2, { kind: "timer", timer: "vote" }, THEMES)).toEqual({ ok: false, error: "not_host" });
  });

  it("G5 AC3 a discussion timer starts with the round and is due after N minutes", () => {
    const room = withTimers(started(4), 3, 0);
    const timer = nextTimer(room, null, 1000);
    expect(timer).toMatchObject({ kind: "discussion", endsAt: 1000 + 3 * MIN, fired: false });
    // Later commands in the same phase keep the same deadline.
    expect(nextTimer(room, timer, 5000)).toBe(timer);
    expect(isDue(room, timer, 1000 + 3 * MIN - 1)).toBe(false);
    expect(isDue(room, timer, 1000 + 3 * MIN)).toBe(true);
    expect(isDue(room, timer && { ...timer, fired: true }, 1000 + 3 * MIN)).toBe(false);
  });

  it("G5 AC4 a vote timer starts when the vote opens and again on a revote", () => {
    let room = withTimers(started(4), 0, 1);
    room = expectOk(openVote(room, 1, turnOf(room))).room;
    const first = nextTimer(room, null, 0);
    expect(first).toMatchObject({ kind: "vote", endsAt: MIN });
    room = expectOk(vote(room, 1, 2, turnOf(room))).room;
    room = expectOk(vote(room, 2, 1, turnOf(room))).room;
    room = expectOk(closeVote(room, 1, turnOf(room))).room;
    expect(room.game?.revote).toBe(true);
    const revote = nextTimer(room, first, 30_000);
    expect(revote).toMatchObject({ kind: "vote", endsAt: 30_000 + MIN });
    expect(revote?.key).not.toBe(first?.key);
  });

  it("G5 AC5 a timer whose phase has moved on is never due", () => {
    let room = withTimers(started(4), 2, 0);
    const timer = nextTimer(room, null, 0);
    room = expectOk(openVote(room, 1, turnOf(room))).room;
    expect(isDue(room, timer, 10 * MIN)).toBe(false);
    expect(nextTimer(room, timer, 10 * MIN)).toBeNull();
  });

  it("G5 AC7 the view carries the timer of the current phase only", () => {
    const room = withTimers(started(4), 2, 0);
    const timer = nextTimer(room, null, 0);
    expect(viewFor(room, 2, timer).game?.timer).toEqual({ kind: "discussion", endsAt: 2 * MIN });
    const voting = expectOk(openVote(room, 1, turnOf(room))).room;
    expect(viewFor(voting, 2, timer).game?.timer).toBeNull();
  });

  it("G5 Telegram buttons carry the timer changes", () => {
    for (const timer of ["discussion", "vote"] as const)
      expect(decodeChange(encodeChange({ kind: "timer", timer }))).toEqual({ kind: "timer", timer });
  });
});
