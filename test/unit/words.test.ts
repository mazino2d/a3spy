import { describe, expect, it } from "vitest";
import { PACKS, pairsOf } from "../../src/game/words";

describe("word packs", () => {
  it("have unique ids", () => {
    const ids = PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(PACKS.map((p) => [p.id, p]))("%s: every pair is two distinct non-empty words", (_, pack) => {
    for (const { a, b } of pack.pairs) {
      expect(a.trim()).not.toBe("");
      expect(b.trim()).not.toBe("");
      expect(a.toLocaleLowerCase("vi")).not.toBe(b.toLocaleLowerCase("vi"));
    }
  });

  it("has no duplicate pair across packs, in either order", () => {
    const keys = pairsOf().map(({ a, b }) =>
      [a, b]
        .map((w) => w.toLocaleLowerCase("vi"))
        .sort()
        .join("|"),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("filters by pack id and falls back to every pack", () => {
    expect(pairsOf(["food"]).length).toBe(PACKS.find((p) => p.id === "food")?.pairs.length);
    expect(pairsOf([]).length).toBe(pairsOf().length);
  });
});
