import { describe, expect, it } from "vitest";
import type { PublicEvent, RoomView } from "../../src/game/view";
import { cleanName, parseClientMessage } from "../../src/web/protocol";
import { nextOutcome } from "../../web/src/outcome";
import { cleanCode, parseRoute } from "../../web/src/parse";
import { endReason, personal, shareCard } from "../../web/src/result";

describe("web input", () => {
  it("W1 AC2 names are trimmed, spaces collapsed, 1–24 characters", () => {
    expect(cleanName("  Lan   Anh ")).toBe("Lan Anh");
    expect(cleanName("Nguyễn Thị Minh Khai Ơi")).toBe("Nguyễn Thị Minh Khai Ơi");
    expect(cleanName("x".repeat(24))).toBe("x".repeat(24));
    for (const bad of ["", "   ", "x".repeat(25), 7, null]) expect(cleanName(bad)).toBeNull();
  });

  it("W1 room links and typed codes are case-insensitive", () => {
    expect(parseRoute("/r/ab12")).toEqual({ name: "room", code: "AB12" });
    expect(parseRoute("/r/AB12/")).toEqual({ name: "room", code: "AB12" });
    expect(parseRoute("/")).toEqual({ name: "home" });
    expect(parseRoute("/r/AB123")).toEqual({ name: "home" });
    expect(cleanCode(" ab12 ")).toBe("AB12");
    expect(cleanCode("AB1")).toBeNull();
  });

  it("only well-formed commands are accepted from a socket", () => {
    expect(parseClientMessage('{"type":"command","action":"start"}')).toEqual({ action: "start" });
    expect(parseClientMessage('{"type":"command","action":"vote","gameId":1,"round":2,"target":-5}')).toEqual({
      action: "vote",
      gameId: 1,
      round: 2,
      target: -5,
    });
    expect(parseClientMessage('{"type":"command","action":"guess","text":"Phở"}')).toEqual({
      action: "guess",
      text: "Phở",
    });
    for (const bad of [
      "nope",
      "null",
      '{"type":"command","action":"vote","gameId":1,"round":2}',
      '{"type":"command","action":"guess","text":"   "}',
      `{"type":"command","action":"guess","text":"${"x".repeat(65)}"}`,
      '{"type":"command","action":"word"}',
      '{"action":"start"}',
    ])
      expect(parseClientMessage(bad)).toBeNull();
  });
});

describe("vote outcome on screen", () => {
  const closed: PublicEvent[] = [
    { type: "vote_closed", tally: { 2: 3 } },
    { type: "eliminated", playerId: 2, role: "spy" },
    { type: "round_started", round: 2, order: [1, 3] },
  ];

  it("W5 AC13 shows the last result until the next vote opens or a game starts", () => {
    const shown = nextOutcome([], closed);
    expect(shown.map((e) => e.type)).toEqual(["vote_closed", "eliminated"]);
    expect(nextOutcome(shown, [{ type: "vote_cast", count: 1, total: 3 }])).toBe(shown);
    expect(nextOutcome(shown, [{ type: "vote_opened", candidates: [1, 3], voters: [1, 3], revote: false }])).toEqual(
      [],
    );
    expect(nextOutcome(shown, [{ type: "game_started", gameId: 2, players: 3, spies: 1, white: 0 }])).toEqual([]);
  });

  it("W5 a tie keeps showing the tie while the revote is open", () => {
    const tie: PublicEvent[] = [
      { type: "vote_closed", tally: { 1: 1, 2: 1 } },
      { type: "tie", tied: [1, 2] },
      { type: "vote_opened", candidates: [1, 2], voters: [1, 2, 3], revote: true },
    ];
    expect(nextOutcome([], tie).map((e) => e.type)).toEqual(["vote_closed", "tie"]);
  });
});

describe("M8 end of game", () => {
  const ended = (winner: "civilians" | "spies" | "white" | null, me = 1): RoomView =>
    ({
      code: "AB12",
      me,
      hostId: 1,
      players: [],
      waiting: [],
      scores: [],
      settings: {} as RoomView["settings"],
      game: {
        id: 3,
        round: 2,
        phase: "ended",
        order: [],
        alive: [1, 2],
        dealt: [
          { id: 1, name: "Khôi" },
          { id: 2, name: "Lan" },
          { id: 3, name: "Minh" },
          { id: 4, name: "Vy" },
        ],
        hand: null,
        canVoteFor: [],
        myVote: null,
        votes: { count: 0, total: 0 },
        revote: false,
        roles: { 1: "civilian", 2: "spy", 3: "white", 4: "civilian" },
        guesser: null,
        words: winner ? { civilian: "Phở", spy: "Bún" } : null,
        winner,
        timer: null,
      },
    }) as RoomView;

  it("U6 AC12 says why the game ended", () => {
    expect(endReason(ended("civilians"))).toBe("civilians");
    expect(endReason(ended("spies"))).toBe("spies");
    expect(endReason(ended("white"))).toBe("white");
    expect(endReason(ended(null))).toBe("ended");
  });

  it("U6 AC11 each player sees their own result; Mr. White wins with the spies or alone", () => {
    expect(personal(ended("civilians", 1))).toEqual({ won: true, role: "civilian" });
    expect(personal(ended("civilians", 2))).toEqual({ won: false, role: "spy" });
    expect(personal(ended("spies", 3))).toEqual({ won: true, role: "white" });
    expect(personal(ended("white", 2))).toEqual({ won: false, role: "spy" });
    expect(personal(ended("white", 3))).toEqual({ won: true, role: "white" });
    // Not dealt in (waiting list) or no winner: no personal result.
    expect(personal(ended("spies", 99))).toBeNull();
    expect(personal(ended(null, 1))).toBeNull();
  });

  it("U7 AC14 AC15 the share card carries only the ended game's public result", () => {
    const card = shareCard(ended("spies", 4));
    expect(card).toEqual({
      winner: "spies",
      words: { civilian: "Phở", spy: "Bún" },
      players: [
        { name: "Khôi", role: "civilian", out: false, me: false },
        { name: "Lan", role: "spy", out: false, me: false },
        { name: "Minh", role: "white", out: true, me: false },
        { name: "Vy", role: "civilian", out: true, me: true },
      ],
      mine: { won: false, role: "civilian" },
      code: "AB12",
      gameId: 3,
    });
    expect(shareCard(ended(null))).toBeNull();
  });
});

describe("U8 routes", () => {
  it("U8 AC16 /luat is the rules page", () => {
    expect(parseRoute("/luat")).toEqual({ name: "rules" });
    expect(parseRoute("/luat/")).toEqual({ name: "rules" });
  });
});
