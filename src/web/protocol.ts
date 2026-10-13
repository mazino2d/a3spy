import type { GameError } from "../game/engine";
import type { PublicEvent, RoomView } from "../game/view";
import type { Command } from "../room/commands";

/**
 * Messages between the web app and its room over a WebSocket. Shared by the
 * Worker and the client (web/), so both sides agree on the shape.
 */

export type ClientMessage = { type: "command" } & Command;

export interface Links {
  /** Room link for the web app, also encoded in the QR code. */
  web: string;
  /** Telegram deep link that joins the same room. */
  telegram: string;
}

export type CloseReason = "left" | "closed" | "replaced";

export type ServerMessage =
  | { type: "state"; view: RoomView; links: Links }
  | { type: "events"; events: PublicEvent[] }
  | { type: "error"; code: GameError | "bad_request" }
  | { type: "closed"; reason: CloseReason };

/** WebSocket close code sent with a "closed" message. */
export const CLOSE_CODE: Record<CloseReason, number> = { left: 4000, closed: 4001, replaced: 4002 };

export const NAME_MAX = 24;
export const GUESS_MAX = 64;

/** Trims and collapses spaces; null when empty or too long. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFC").trim().replace(/\s+/g, " ");
  return name.length > 0 && [...name].length <= NAME_MAX ? name : null;
}

const int = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x);

/** Validates a message from a web client; null when it is malformed. */
export function parseClientMessage(raw: string): Command | null {
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof m !== "object" || m === null || m.type !== "command") return null;
  switch (m.action) {
    case "start":
    case "leave":
      return { action: m.action };
    case "again":
    case "openVote":
    case "closeVote":
      return int(m.gameId) && int(m.round) ? { action: m.action, gameId: m.gameId, round: m.round } : null;
    case "end":
      return int(m.gameId) ? { action: "end", gameId: m.gameId } : null;
    case "vote":
      return int(m.gameId) && int(m.round) && int(m.target)
        ? { action: "vote", gameId: m.gameId, round: m.round, target: m.target }
        : null;
    case "guess":
      return typeof m.text === "string" && m.text.trim() !== "" && [...m.text].length <= GUESS_MAX
        ? { action: "guess", text: m.text }
        : null;
    default:
      return null;
  }
}
