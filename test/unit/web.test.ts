import { describe, expect, it } from "vitest";
import type { PublicEvent } from "../../src/game/view";
import { cleanName, parseClientMessage } from "../../src/web/protocol";
import { nextOutcome } from "../../web/src/outcome";
import { cleanCode, parseRoute } from "../../web/src/parse";

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
