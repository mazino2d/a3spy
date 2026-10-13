import { describe, expect, it } from "vitest";
import {
  checkWinner,
  closeVote,
  createRoom,
  end,
  guess,
  join,
  leave,
  normalizeGuess,
  openVote,
  type Room,
  speakingOrder,
  start,
  vote,
  winners,
} from "../../src/game/engine";
import { seededRng } from "../../src/game/rng";
import { expectOk, idsWithRole, lobby, ofType, PAIRS, player, started, turnOf } from "../helpers/game";

/** Everyone alive votes for `target` (target votes for someone else). */
function everyoneVotes(room: Room, target: number): ReturnType<typeof expectOk> {
  let r = room;
  let events: ReturnType<typeof expectOk>["events"] = [];
  const voters = [...(room.game?.alive ?? [])];
  for (const voter of voters) {
    const pick = voter === target ? (voters.find((id) => id !== target) as number) : target;
    const res = expectOk(vote(r, voter, pick, turnOf(r)));
    r = res.room;
    events = [...events, ...res.events];
    if (r.game?.phase !== "voting") break;
  }
  return { room: r, events };
}

const voting = (room: Room) => expectOk(openVote(room, room.hostId, turnOf(room))).room;

describe("rooms", () => {
  it("L1 the creator is host and first player", () => {
    const room = createRoom("ABCD", player(1));
    expect(room.hostId).toBe(1);
    expect(room.players).toEqual([player(1)]);
  });

  it("L2 joining twice is rejected", () => {
    const room = expectOk(join(lobby(2), player(3))).room;
    expect(join(room, player(3))).toEqual({ ok: false, error: "already_in_room" });
    expect(room.players.map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it("L5 joining a running game queues the player for the next game", () => {
    const { room, events } = expectOk(join(started(4), player(9)));
    expect(events).toEqual([{ type: "queued", player: player(9) }]);
    expect(room.game?.hands.some((h) => h.playerId === 9)).toBe(false);

    const ended = expectOk(end(room, 1)).room;
    const next = expectOk(start(ended, 1, { rng: seededRng(2), pairs: PAIRS, now: 0 })).room;
    expect(next.game?.hands.some((h) => h.playerId === 9)).toBe(true);
    expect(next.waiting).toEqual([]);
  });

  it("E4 host leaving hands host to the earliest remaining joiner", () => {
    const { room, events } = expectOk(leave(lobby(3), 1));
    expect(room.hostId).toBe(2);
    expect(ofType(events, "host_changed")).toEqual([{ type: "host_changed", hostId: 2 }]);
  });

  it("E4 last player leaving closes the room", () => {
    const { events } = expectOk(leave(createRoom("ABCD", player(1)), 1));
    expect(ofType(events, "closed")).toHaveLength(1);
  });

  it("leaving a room you are not in is rejected", () => {
    expect(leave(lobby(3), 9)).toEqual({ ok: false, error: "not_in_room" });
  });
});

describe("start", () => {
  it("L3 needs at least 3 players", () => {
    expect(start(lobby(2), 1, { rng: seededRng(1), pairs: PAIRS, now: 0 })).toEqual({
      ok: false,
      error: "too_few_players",
    });
  });

  it("L3 only the host can start", () => {
    expect(start(lobby(4), 2, { rng: seededRng(1), pairs: PAIRS, now: 0 })).toEqual({ ok: false, error: "not_host" });
  });

  it("R1 deals default role counts and two different words", () => {
    const room = started(7);
    expect(idsWithRole(room, "spy")).toHaveLength(2);
    expect(idsWithRole(room, "white")).toHaveLength(1);
    expect(room.game?.civilianWord).not.toBe(room.game?.spyWord);
  });

  it("cannot start while a game is running", () => {
    expect(start(started(4), 1, { rng: seededRng(1), pairs: PAIRS, now: 0 })).toEqual({
      ok: false,
      error: "game_running",
    });
  });

  it("E2 does not repeat a pair used in the room within 24 hours", () => {
    let room = started(4, 1, 0);
    const first = [room.game?.civilianWord, room.game?.spyWord].sort();
    for (let seed = 2; seed < 12; seed++) {
      room = expectOk(end(room, 1)).room;
      room = expectOk(start(room, 1, { rng: seededRng(seed), pairs: PAIRS, now: 1000 })).room;
      expect([room.game?.civilianWord, room.game?.spyWord].sort()).not.toEqual(first);
      room = { ...room, recentPairs: room.recentPairs.slice(0, 1) };
    }
  });

  it("E2 reuses pairs once every pair was played in the last 24 hours", () => {
    let room = started(4, 1, 0);
    room = expectOk(start(expectOk(end(room, 1)).room, 1, { rng: seededRng(2), pairs: PAIRS, now: 1 })).room;
    const third = start(expectOk(end(room, 1)).room, 1, { rng: seededRng(3), pairs: PAIRS, now: 2 });
    expect(third.ok).toBe(true);
  });

  it("E2 play again keeps players and scores", () => {
    const room = started(4);
    const ended = expectOk(end(room, 1)).room;
    const again = expectOk(start({ ...ended, scores: { 2: 3 } }, 1, { rng: seededRng(5), pairs: PAIRS, now: 0 })).room;
    expect(again.players.map((p) => p.id)).toEqual([1, 2, 3, 4]);
    expect(again.scores).toEqual({ 2: 3 });
    expect(again.game?.id).toBe(2);
  });
});

describe("speaking order", () => {
  it("G1 contains every living player once and Mr. White is never first", () => {
    for (let seed = 0; seed < 200; seed++) {
      const room = started(6, seed);
      const game = room.game as NonNullable<Room["game"]>;
      expect([...game.order].sort()).toEqual([...game.alive].sort());
      expect(idsWithRole(room, "white")).not.toContain(game.order[0]);
    }
  });

  it("G1 Mr. White alone with one other is moved off first place", () => {
    const hands = [
      { playerId: 1, role: "white" as const, word: null },
      { playerId: 2, role: "civilian" as const, word: "x" },
    ];
    for (let seed = 0; seed < 20; seed++) expect(speakingOrder([1, 2], hands, seededRng(seed))[0]).toBe(2);
  });
});

describe("voting", () => {
  it("G2 only the host opens the vote, during describing", () => {
    const room = started(5);
    expect(openVote(room, 2, turnOf(room))).toEqual({ ok: false, error: "not_host" });
    const v = voting(room);
    expect(openVote(v, 1, turnOf(v))).toEqual({ ok: false, error: "wrong_phase" });
  });

  it("G2 rejects self votes, votes for non-candidates and stale buttons", () => {
    const room = voting(started(5));
    expect(vote(room, 2, 2, turnOf(room))).toEqual({ ok: false, error: "invalid_target" });
    expect(vote(room, 2, 99, turnOf(room))).toEqual({ ok: false, error: "invalid_target" });
    expect(vote(room, 2, 3, { gameId: 1, round: 0 })).toEqual({ ok: false, error: "stale" });
    expect(vote(room, 2, 3, { gameId: 0, round: 1 })).toEqual({ ok: false, error: "stale" });
  });

  it("G2 a vote can be changed before close and the count does not double", () => {
    let room = voting(started(5));
    room = expectOk(vote(room, 2, 3, turnOf(room))).room;
    const { room: after, events } = expectOk(vote(room, 2, 4, turnOf(room)));
    expect(after.game?.votes).toEqual({ 2: 4 });
    expect(ofType(events, "vote_cast")[0]).toMatchObject({ count: 1, total: 5 });
  });

  it("G3 closes automatically when every living player has voted", () => {
    const room = voting(started(5));
    const target = idsWithRole(room, "spy")[0] as number;
    const { events } = everyoneVotes(room, target);
    expect(ofType(events, "vote_closed")).toHaveLength(1);
    expect(ofType(events, "eliminated")[0]).toMatchObject({ playerId: target, role: "spy" });
  });

  it("G2 eliminated players cannot vote", () => {
    let room = voting(started(9, 3));
    const civilian = idsWithRole(room, "civilian")[0] as number;
    room = everyoneVotes(room, civilian).room;
    room = voting(room);
    const other = room.game?.alive.find((id) => id !== civilian) as number;
    expect(vote(room, civilian, other, turnOf(room))).toEqual({ ok: false, error: "not_alive" });
  });

  it("G3 a tie triggers one revote among the tied players only", () => {
    let room = voting(started(4, 7));
    const [a, b, c, d] = (room.game as NonNullable<Room["game"]>).alive;
    for (const [voter, target] of [
      [a, b],
      [b, a],
      [c, a],
      [d, b],
    ] as const)
      room = expectOk(vote(room, voter as number, target as number, turnOf(room))).room;
    expect(room.game?.revote).toBe(true);
    expect([...(room.game?.candidates ?? [])].sort()).toEqual([a, b].sort());
    expect(vote(room, a as number, c as number, turnOf(room))).toEqual({ ok: false, error: "invalid_target" });
  });

  it("G3 a second tie eliminates nobody and starts the next round", () => {
    let room = voting(started(4, 7));
    const [a, b, c, d] = (room.game as NonNullable<Room["game"]>).alive;
    const round = (pairs: [number, number][]) => {
      let events: ReturnType<typeof expectOk>["events"] = [];
      for (const [voter, target] of pairs) {
        const r = expectOk(vote(room, voter, target, turnOf(room)));
        room = r.room;
        events = r.events;
      }
      return events;
    };
    round([
      [a as number, b as number],
      [b as number, a as number],
      [c as number, a as number],
      [d as number, b as number],
    ]);
    const events = round([
      [a as number, b as number],
      [b as number, a as number],
      [c as number, a as number],
      [d as number, b as number],
    ]);
    expect(ofType(events, "no_elimination")).toEqual([{ type: "no_elimination", reason: "tie" }]);
    expect(room.game?.round).toBe(2);
    expect(room.game?.alive).toHaveLength(4);
  });

  it("G3 closing with no votes eliminates nobody", () => {
    const room = voting(started(5));
    const { room: after, events } = expectOk(closeVote(room, 1, turnOf(room)));
    expect(ofType(events, "no_elimination")).toEqual([{ type: "no_elimination", reason: "no_votes" }]);
    expect(after.game?.phase).toBe("describing");
    expect(after.game?.round).toBe(2);
  });

  it("G3 the next round drops eliminated players from the speaking order", () => {
    const room = voting(started(9, 3));
    const civilian = idsWithRole(room, "civilian")[0] as number;
    const { room: after, events } = everyoneVotes(room, civilian);
    const next = ofType(events, "round_started")[0];
    expect(next?.round).toBe(2);
    expect(next?.order).not.toContain(civilian);
    expect(after.game?.phase).toBe("describing");
  });
});

describe("winning", () => {
  it("G3 civilians win when every spy and Mr. White is out", () => {
    let room = voting(started(4, 2));
    const spy = idsWithRole(room, "spy")[0] as number;
    const { room: after, events } = everyoneVotes(room, spy);
    room = after;
    expect(ofType(events, "game_ended")[0]?.winner).toBe("civilians");
    expect(room.game?.phase).toBe("ended");
  });

  it("G3 spies win when civilians alive ≤ spies + Mr. White alive", () => {
    let room = voting(started(4, 2));
    const civilians = idsWithRole(room, "civilian");
    room = everyoneVotes(room, civilians[0] as number).room;
    room = voting(room);
    const { events } = everyoneVotes(room, civilians[1] as number);
    expect(ofType(events, "game_ended")[0]?.winner).toBe("spies");
  });

  it("checkWinner counts Mr. White on the spy side", () => {
    const room = started(5, 4);
    const game = room.game as NonNullable<Room["game"]>;
    const white = idsWithRole(room, "white")[0] as number;
    const spy = idsWithRole(room, "spy")[0] as number;
    const civ = idsWithRole(room, "civilian");
    expect(checkWinner({ ...game, alive: [white, spy, civ[0] as number, civ[1] as number] })).toBe("spies");
    expect(checkWinner({ ...game, alive: [white, civ[0] as number, civ[1] as number] })).toBeNull();
  });

  it("S1 every player on the winning side scores, alive or not", () => {
    let room = voting(started(4, 2));
    const civilians = idsWithRole(room, "civilian");
    const spy = idsWithRole(room, "spy")[0] as number;
    room = everyoneVotes(room, civilians[0] as number).room;
    room = voting(room);
    room = everyoneVotes(room, spy).room;
    expect(room.game?.winner).toBe("civilians");
    for (const id of civilians) expect(room.scores[id]).toBe(1);
    expect(room.scores[spy]).toBeUndefined();
    expect(winners(room.game as NonNullable<Room["game"]>).sort()).toEqual([...civilians].sort());
  });

  it("E3 only the host ends the game early, with no winner and no score", () => {
    const room = started(5);
    expect(end(room, 2)).toEqual({ ok: false, error: "not_host" });
    const { room: after, events } = expectOk(end(room, 1));
    expect(ofType(events, "game_ended")[0]?.winner).toBeNull();
    expect(after.scores).toEqual({});
    expect(end(after, 1)).toEqual({ ok: false, error: "no_game" });
  });
});

describe("Mr. White", () => {
  function whiteOut(seed = 4) {
    const room = voting(started(5, seed));
    const white = idsWithRole(room, "white")[0] as number;
    const { room: after, events } = everyoneVotes(room, white);
    return { room: after, events, white };
  }

  it("G4 being voted out opens a guess instead of the next round", () => {
    const { room, events, white } = whiteOut();
    expect(ofType(events, "white_guessing")).toEqual([{ type: "white_guessing", playerId: white }]);
    expect(room.game?.phase).toBe("white_guess");
  });

  it("G4 a correct guess wins alone, ignoring case and extra spaces", () => {
    const { room, white } = whiteOut();
    const word = room.game?.civilianWord as string;
    const { room: after, events } = expectOk(guess(room, white, `  ${word.toUpperCase().replace(" ", "   ")} `));
    expect(ofType(events, "white_guessed")[0]?.correct).toBe(true);
    expect(after.game?.winner).toBe("white");
    expect(after.scores).toEqual({ [white]: 1 });
  });

  it("G4 a wrong guess continues the game", () => {
    const { room, white } = whiteOut();
    const { room: after, events } = expectOk(guess(room, white, "sai bét"));
    expect(ofType(events, "white_guessed")[0]?.correct).toBe(false);
    expect(after.game?.phase).toBe("describing");
    expect(after.game?.round).toBe(2);
  });

  it("G4 nobody else can guess", () => {
    const { room, white } = whiteOut();
    const other = room.game?.alive.find((id) => id !== white) as number;
    expect(guess(room, other, room.game?.civilianWord as string)).toEqual({ ok: false, error: "not_white" });
  });

  it("G4 diacritics must match", () => {
    expect(normalizeGuess("Trà sữa")).not.toBe(normalizeGuess("Tra sua"));
    expect(normalizeGuess("  TRÀ   sữa ")).toBe(normalizeGuess("trà sữa"));
  });

  it("G4 Mr. White leaving instead of guessing resumes the game", () => {
    const { room, white } = whiteOut();
    const { room: after } = expectOk(leave(room, white));
    expect(after.game?.phase).toBe("describing");
  });
});

describe("leaving mid-game", () => {
  it("an alive player leaving is eliminated and their role revealed", () => {
    const room = started(7, 3);
    const civilian = idsWithRole(room, "civilian")[0] as number;
    const { room: after, events } = expectOk(leave(room, civilian));
    expect(ofType(events, "eliminated")).toEqual([{ type: "eliminated", playerId: civilian, role: "civilian" }]);
    expect(after.game?.alive).not.toContain(civilian);
    expect(after.game?.names[civilian]).toBe(`P${civilian}`);
  });

  it("the last missing voter leaving closes the vote", () => {
    let room = voting(started(9, 3));
    const alive = room.game?.alive as number[];
    const target = idsWithRole(room, "spy")[0] as number;
    const leaver = alive.find((id) => id !== target && id !== 1) as number;
    for (const voter of alive.filter((id) => id !== leaver)) {
      const pick = voter === target ? (alive.find((id) => id !== target && id !== leaver) as number) : target;
      room = expectOk(vote(room, voter, pick, turnOf(room))).room;
    }
    const { events } = expectOk(leave(room, leaver));
    expect(ofType(events, "vote_closed")).toHaveLength(1);
  });

  it("the spy leaving can end the game", () => {
    const room = started(4, 2);
    const spy = idsWithRole(room, "spy")[0] as number;
    const { events } = expectOk(leave(room, spy));
    expect(ofType(events, "game_ended")[0]?.winner).toBe("civilians");
  });
});
