import { describe, expect, it } from "vitest";
import { cleanName, parseClientMessage } from "../../src/web/protocol";
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
