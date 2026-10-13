import { describe, expect, it } from "vitest";
import { end, guess, openVote, type Room, vote } from "../../src/game/engine";
import { addResult, emptyStats, gameResults, leaderboard, type PlayerStats } from "../../src/game/stats";
import { expectOk, idsWithRole, started, turnOf } from "../helpers/game";

/** Everyone votes `target` out (target votes for someone else). */
function voteOut(room: Room, target: number): Room {
  let r = expectOk(openVote(room, room.hostId, turnOf(room))).room;
  for (const voter of [...(r.game?.alive ?? [])]) {
    if (r.game?.phase !== "voting") break;
    const pick = voter === target ? (r.game.alive.find((id) => id !== target) as number) : target;
    r = expectOk(vote(r, voter, pick, turnOf(r))).room;
  }
  return r;
}

const stats = (id: number, wins: number, games: number): PlayerStats => ({ ...emptyStats(id, `P${id}`), wins, games });

describe("S2 long-term stats", () => {
  it("S2 AC1 every dealt player gets a game; the winning side gets a win; roles are counted", () => {
    const room = started(4, 1);
    const [spy] = idsWithRole(room, "spy") as [number];
    const ended = voteOut(room, spy).game;
    expect(ended?.winner).toBe("civilians");
    const results = gameResults(ended as NonNullable<typeof ended>);
    expect(results).toHaveLength(4);
    for (const r of results) expect(r.won).toBe(r.role === "civilian");

    const spyStats = addResult(emptyStats(spy, "x"), results.find((r) => r.id === spy) as (typeof results)[0]);
    expect(spyStats).toMatchObject({ games: 1, wins: 0, spy: { games: 1, wins: 0 }, white: { games: 0 } });
  });

  it("S2 AC2 a correct Mr. White guess counts as a win and a correct guess", () => {
    let room = started(5, 2);
    const [white] = idsWithRole(room, "white") as [number];
    room = voteOut(room, white);
    expect(room.game?.phase).toBe("white_guess");
    room = expectOk(guess(room, white, room.game?.civilianWord as string)).room;
    const r = gameResults(room.game as NonNullable<typeof room.game>).find((x) => x.id === white);
    expect(r).toMatchObject({ role: "white", won: true, guessed: true });
    const s = addResult(emptyStats(white, "W"), r as NonNullable<typeof r>);
    expect(s.white).toEqual({ games: 1, wins: 1, correct: 1 });
  });

  it("S2 AC3 a game ended early counts for nobody", () => {
    const room = expectOk(end(started(4), 1)).room;
    expect(gameResults(room.game as NonNullable<typeof room.game>)).toEqual([]);
  });

  it("S2 AC4 the leaderboard ranks by wins, then win rate, top 10, skipping players with no games", () => {
    const board = leaderboard([stats(1, 3, 10), stats(2, 3, 5), stats(3, 5, 9), stats(4, 0, 0)]);
    expect(board.map((s) => s.id)).toEqual([3, 2, 1]);
    expect(leaderboard(Array.from({ length: 15 }, (_, i) => stats(i + 1, i, 20)))).toHaveLength(10);
  });

  it("S2 AC7 results never carry a word", () => {
    const room = started(6, 3);
    const [spy] = idsWithRole(room, "spy") as [number];
    const results = JSON.stringify(gameResults(voteOut(room, spy).game as NonNullable<Room["game"]>));
    expect(results).not.toContain(room.game?.civilianWord as string);
    expect(results).not.toContain(room.game?.spyWord as string);
  });
});
