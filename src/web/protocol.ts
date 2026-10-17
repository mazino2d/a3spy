import type { GameError } from "../game/engine";
import type { PublicEvent, RoomView } from "../game/view";
import type { Command } from "../room/commands";
import type { Sdp } from "../voice/realtime";
import type { VoiceMember } from "../voice/roster";

/**
 * Messages between the web app and its room over a WebSocket. Shared by the
 * Worker and the client (web/), so both sides agree on the shape.
 */

export type CommandMessage = { type: "command" } & Command;

/** Voice call signaling (docs/implementations/M6-remote-voice.md). */
export type VoiceOp =
  /** Publish this device's audio: the offer and the mid of its send transceiver. */
  | { op: "join"; sdp: string; mid: string }
  /** Receive these players' audio; answered with a voiceSdp offer. */
  | { op: "pull"; ids: number[] }
  /** The device's answer to a voiceSdp offer. */
  | { op: "answer"; sdp: string }
  | { op: "mute"; muted: boolean }
  /** After the room socket reconnects: take back this player's seat, whose track is `key`. */
  | { op: "resume"; key: string }
  | { op: "leave" };

export type VoiceMessage = { type: "voice" } & VoiceOp;

export type ClientMessage = CommandMessage | VoiceMessage;

export type VoiceError = "voice_off" | "not_in_call" | "unavailable" | "bad_request";

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
  | { type: "closed"; reason: CloseReason }
  /** Whether the room has voice on, and who is in the call. Sent with every state and on every call change. */
  | { type: "voice"; on: boolean; members: VoiceMember[] }
  /** The SFU's answer to a join, or its offer after a pull; mids map pulled players to transceivers. */
  | { type: "voiceSdp"; sdp: Sdp | null; tracks: { id: number; key: string; mid: string }[] }
  | { type: "voiceError"; code: VoiceError };

/** WebSocket close code sent with a "closed" message. */
export const CLOSE_CODE: Record<CloseReason, number> = { left: 4000, closed: 4001, replaced: 4002 };

export const NAME_MAX = 24;
export const SDP_MAX = 32_000;
const PULL_MAX = 30;
export const GUESS_MAX = 64;

/** Trims and collapses spaces; null when empty or too long. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFC").trim().replace(/\s+/g, " ");
  return name.length > 0 && [...name].length <= NAME_MAX ? name : null;
}

const int = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x);

function parseChange(raw: unknown): Command | null {
  if (typeof raw !== "object" || raw === null) return null;
  const c = raw as Record<string, unknown>;
  if (c.kind === "spies" && (c.delta === 1 || c.delta === -1))
    return { action: "configure", change: { kind: "spies", delta: c.delta } };
  if (c.kind === "white" || c.kind === "auto" || c.kind === "allThemes" || c.kind === "voice")
    return { action: "configure", change: { kind: c.kind } };
  if (c.kind === "timer" && (c.timer === "discussion" || c.timer === "vote"))
    return { action: "configure", change: { kind: "timer", timer: c.timer } };
  if (c.kind === "theme" && typeof c.theme === "string" && c.theme.length <= 32)
    return { action: "configure", change: { kind: "theme", theme: c.theme } };
  return null;
}

const sdp = (x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length <= SDP_MAX;

function parseVoice(m: Record<string, unknown>): VoiceOp | null {
  switch (m.op) {
    case "join":
      return sdp(m.sdp) && typeof m.mid === "string" && m.mid.length > 0 && m.mid.length <= 16
        ? { op: "join", sdp: m.sdp, mid: m.mid }
        : null;
    case "pull":
      return Array.isArray(m.ids) && m.ids.length > 0 && m.ids.length <= PULL_MAX && m.ids.every(int)
        ? { op: "pull", ids: m.ids }
        : null;
    case "answer":
      return sdp(m.sdp) ? { op: "answer", sdp: m.sdp } : null;
    case "mute":
      return typeof m.muted === "boolean" ? { op: "mute", muted: m.muted } : null;
    case "resume":
      return typeof m.key === "string" && m.key.length > 0 && m.key.length <= 64 ? { op: "resume", key: m.key } : null;
    case "leave":
      return { op: "leave" };
    default:
      return null;
  }
}

function parseJson(raw: string): Record<string, unknown> | null {
  try {
    const m = JSON.parse(raw);
    return typeof m === "object" && m !== null ? m : null;
  } catch {
    return null;
  }
}

/** Validates a message from a web client; null when it is malformed. */
export function parseMessage(raw: string): { type: "command"; cmd: Command } | VoiceMessage | null {
  const m = parseJson(raw);
  if (m?.type === "voice") {
    const op = parseVoice(m);
    return op ? { type: "voice", ...op } : null;
  }
  const cmd = m && parseCommand(m);
  return cmd ? { type: "command", cmd } : null;
}

/** The command in a web client's message; null when it is malformed or not a command. */
export function parseClientMessage(raw: string): Command | null {
  const m = parseJson(raw);
  return m && parseCommand(m);
}

function parseCommand(m: Record<string, unknown>): Command | null {
  if (m.type !== "command") return null;
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
    case "configure":
      return parseChange(m.change);
    case "guess":
      return typeof m.text === "string" && m.text.trim() !== "" && [...m.text].length <= GUESS_MAX
        ? { action: "guess", text: m.text }
        : null;
    default:
      return null;
  }
}
