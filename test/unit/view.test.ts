import { describe, expect, it } from "vitest";
import { closeVote, end, type GameEvent, join, openVote, type Room, start, vote } from "../../src/game/engine";
import { seededRng } from "../../src/game/rng";
import { publicEvents, viewFor } from "../../src/game/view";
import { decide } from "../../src/room/commands";
import { expectOk, idsWithRole, lobby, PAIRS, player, started, turnOf } from "../helpers/game";

const words = (room: Room) => [room.game?.civilianWord, room.game?.spyWord] as string[];
const json = (x: unknown) => JSON.stringify(x);

/** Everything in a view that is not the viewer's own hand. */
const withoutHand = (room: Room, viewer: number) => {
  const view = viewFor(room, viewer);
  return { ...view, game: view.game ? { ...view.game, hand: null } : null };
};

describe("viewFor secrecy", () => {
  it("W3 AC9 a player sees their own word and no other word or role, for 3–12 players over many seeds", () => {
    for (let n = 3; n <= 12; n++) {
      for (let seed = 1; seed <= 20; seed++) {
        const room = started(n, seed);
        for (const h of room.game?.hands ?? []) {
          const view = viewFor(room, h.playerId);
          expect(view.game?.hand).toEqual({ word: h.word });
          expect(view.game?.roles).toEqual({});
          expect(view.game?.words).toBeNull();
          // Nothing else in the view carries a word.
          const rest = json(withoutHand(room, h.playerId));
          for (const w of words(room)) expect(rest).not.toContain(w);
          // The view never names the viewer's own role.
          expect(json(view)).not.toMatch(/"(civilian|spy)"/);
        }
      }
    }
  });

  it("W3 AC7 civilians and spies get the same shape; Mr. White gets a null word", () => {
    const room = started(7, 3);
    const [spy] = idsWithRole(room, "spy");
    const [civilian] = idsWithRole(room, "civilian");
    const [white] = idsWithRole(room, "white");
    const keys = (id: number) => Object.keys(viewFor(room, id).game?.hand ?? {});
    expect(keys(spy as number)).toEqual(keys(civilian as number));
    expect(viewFor(room, white as number).game?.hand).toEqual({ word: null });
  });

  it("W3 AC9 an eliminated player's role becomes public, the others stay hidden", () => {
    let room = started(6, 2);
    const [spy] = idsWithRole(room, "spy") as [number];
    room = expectOk(openVote(room, room.hostId, turnOf(room))).room;
    const civilians = idsWithRole(room, "civilian");
    const target = civilians.find((id) => id !== room.hostId) as number;
    for (const voter of room.game?.alive ?? []) {
      if (room.game?.phase !== "voting") break;
      room = expectOk(vote(room, voter, voter === target ? spy : target, turnOf(room))).room;
    }
    const view = viewFor(room, spy);
    expect(view.game?.roles).toEqual({ [target]: "civilian" });
    expect(view.game?.words).toBeNull();
  });

  it("E1 everything is revealed once the game has ended", () => {
    const room = expectOk(end(started(5, 4), 1)).room;
    const view = viewFor(room, 2);
    expect(Object.keys(view.game?.roles ?? {})).toHaveLength(5);
    expect(view.game?.words).toEqual({ civilian: room.game?.civilianWord, spy: room.game?.spyWord });
  });

  it("W8 a waiting player sees the game but has no hand", () => {
    const room = expectOk(join(started(4), player(9))).room;
    const view = viewFor(room, 9);
    expect(view.waiting.map((p) => p.id)).toEqual([9]);
    expect(view.game?.hand).toBeNull();
    for (const w of words(room)) expect(json(view)).not.toContain(w);
  });
});

describe("viewFor votes", () => {
  it("W4 AC11 a living player may vote for every candidate but themselves and sees only their own vote", () => {
    let room = expectOk(openVote(started(5), 1, turnOf(started(5)))).room;
    room = expectOk(vote(room, 2, 3, turnOf(room))).room;
    room = expectOk(vote(room, 4, 3, turnOf(room))).room;
    const v2 = viewFor(room, 2).game;
    expect(v2?.canVoteFor).toEqual(room.game?.candidates.filter((id) => id !== 2));
    expect(v2?.myVote).toBe(3);
    expect(v2?.votes).toEqual({ count: 2, total: 5 });
    expect(viewFor(room, 5).game?.myVote).toBeNull();
    expect(json(viewFor(room, 5))).not.toContain('"votes":{"2"');
  });

  it("W4 AC11 nobody can vote outside the voting phase", () => {
    expect(viewFor(started(5), 2).game?.canVoteFor).toEqual([]);
  });

  it("W5 AC13 after a tie only the tied players are candidates", () => {
    let room = started(4, 1);
    room = expectOk(openVote(room, 1, turnOf(room))).room;
    room = expectOk(vote(room, 1, 2, turnOf(room))).room;
    room = expectOk(vote(room, 2, 1, turnOf(room))).room;
    room = expectOk(closeVote(room, 1, turnOf(room))).room;
    expect(viewFor(room, 3).game).toMatchObject({ revote: true, canVoteFor: [2, 1].sort() });
  });
});

describe("publicEvents", () => {
  it("W3 AC9 drops the dealt hands and individual ballots", () => {
    const r = expectOk(start(lobby(5), 1, { rng: seededRng(1), pairs: PAIRS, now: 0 }));
    const opened = expectOk(openVote(r.room, 1, turnOf(r.room)));
    const cast = expectOk(vote(opened.room, 2, 3, turnOf(opened.room)));
    const events: GameEvent[] = [...r.events, ...opened.events, ...cast.events];
    const out = json(publicEvents(events));
    for (const w of words(r.room)) expect(out).not.toContain(w);
    expect(publicEvents(cast.events)).toEqual([{ type: "vote_cast", count: 1, total: 5 }]);
    expect(publicEvents(r.events)[0]).toEqual({ type: "game_started", gameId: 1, players: 5, spies: 1, white: 1 });
  });
});

describe("decide", () => {
  const deps = { rng: seededRng(1), pairs: PAIRS, now: 0 };

  it("W5 AC16 a command from an earlier game or round is stale", () => {
    const room = started(5);
    expect(decide(room, 1, { action: "openVote", gameId: 2, round: 1 }, deps)).toEqual({ ok: false, error: "stale" });
    expect(decide(room, 1, { action: "end", gameId: 9 }, deps)).toEqual({ ok: false, error: "stale" });
    expect(decide(room, 1, { action: "again", gameId: 9, round: 1 }, deps)).toEqual({ ok: false, error: "stale" });
    expect(decide(room, 1, { action: "end" }, deps).ok).toBe(true);
  });

  it("W5 start while a game is running is refused", () => {
    expect(decide(started(5), 1, { action: "start" }, deps)).toEqual({ ok: false, error: "game_running" });
  });
});

describe("display names", () => {
  it("W7 AC19 players with the same name get a suffix", () => {
    let room = lobby(1);
    room = expectOk(join(room, { id: 2, name: "Minh" })).room;
    room = expectOk(join(room, { id: -3, name: "minh" })).room;
    room = expectOk(join(room, { id: 4, name: "Minh" })).room;
    expect(room.players.map((p) => p.name)).toEqual(["P1", "Minh", "minh (2)", "Minh (3)"]);
  });
});
