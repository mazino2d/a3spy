import { describe, expect, it } from "vitest";
import { seededRng } from "../../src/game/rng";
import { checkRoleCounts, deal, defaultRoleCounts } from "../../src/game/roles";

const ids = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const pair = { a: "Trà sữa", b: "Cà phê sữa" };

describe("defaultRoleCounts", () => {
  it.each([
    [3, 1, 0],
    [4, 1, 0],
    [5, 1, 1],
    [6, 1, 1],
    [7, 2, 1],
    [9, 2, 1],
    [10, 3, 1],
    [12, 3, 1],
    [15, 3, 1],
  ])("%i players → %i spies, %i Mr. White", (players, spies, white) => {
    expect(defaultRoleCounts(players)).toEqual({ spies, white });
  });

  it("rejects fewer than 3 players", () => {
    expect(() => defaultRoleCounts(2)).toThrow(RangeError);
  });

  it("keeps civilians the majority for every player count 3–20", () => {
    for (let n = 3; n <= 20; n++) {
      expect(checkRoleCounts(n, defaultRoleCounts(n))).toBeNull();
    }
  });
});

describe("checkRoleCounts", () => {
  it("requires at least one spy", () => {
    expect(checkRoleCounts(6, { spies: 0, white: 1 })).toBe("no_spy");
  });

  it("requires civilians to outnumber spies + Mr. White", () => {
    expect(checkRoleCounts(6, { spies: 2, white: 1 })).toBe("civilians_not_majority");
  });
});

describe("deal", () => {
  it("deals the expected roles to every player exactly once", () => {
    const hands = deal(ids(7), pair, { spies: 2, white: 1 }, seededRng(1));

    expect(hands.map((h) => h.playerId).sort((x, y) => x - y)).toEqual(ids(7));
    expect(hands.filter((h) => h.role === "spy")).toHaveLength(2);
    expect(hands.filter((h) => h.role === "white")).toHaveLength(1);
    expect(hands.filter((h) => h.role === "civilian")).toHaveLength(4);
  });

  it("gives civilians one word, spies the other, Mr. White none", () => {
    const hands = deal(ids(7), pair, { spies: 2, white: 1 }, seededRng(2));
    const civilianWords = new Set(hands.filter((h) => h.role === "civilian").map((h) => h.word));
    const spyWords = new Set(hands.filter((h) => h.role === "spy").map((h) => h.word));

    expect(civilianWords.size).toBe(1);
    expect(spyWords.size).toBe(1);
    expect([...civilianWords, ...spyWords].sort()).toEqual([pair.a, pair.b].sort());
    expect(hands.find((h) => h.role === "white")?.word).toBeNull();
  });

  it("varies which word of the pair goes to civilians", () => {
    const civilianWords = new Set(
      Array.from(
        { length: 20 },
        (_, seed) =>
          deal(ids(4), pair, { spies: 1, white: 0 }, seededRng(seed)).find((h) => h.role === "civilian")?.word,
      ),
    );
    expect(civilianWords).toEqual(new Set([pair.a, pair.b]));
  });

  it("is reproducible for the same seed", () => {
    expect(deal(ids(8), pair, defaultRoleCounts(8), seededRng(42))).toEqual(
      deal(ids(8), pair, defaultRoleCounts(8), seededRng(42)),
    );
  });

  it("refuses unplayable counts", () => {
    expect(() => deal(ids(4), pair, { spies: 2, white: 0 }, seededRng(1))).toThrow("civilians_not_majority");
  });
});
