/** Inline button payloads: `<action>|<room>|<game>|<round>|<arg>`, well under Telegram's 64-byte limit. */

import type { SettingsChange } from "../game/engine";
import { PACKS } from "../game/words";

export type Action = "start" | "leave" | "openVote" | "closeVote" | "vote" | "word" | "again" | "end" | "configure";

const CODES: Record<Action, string> = {
  start: "s",
  leave: "l",
  openVote: "ov",
  closeVote: "cv",
  vote: "v",
  word: "w",
  again: "a",
  end: "e",
  configure: "c",
};
const ACTIONS = Object.fromEntries(Object.entries(CODES).map(([a, c]) => [c, a as Action]));

export interface Callback {
  action: Action;
  code: string;
  gameId: number;
  round: number;
  arg: number;
}

export function encode(cb: Callback): string {
  return [CODES[cb.action], cb.code, cb.gameId, cb.round, cb.arg].join("|");
}

export function decode(data: string): Callback | null {
  const [a, code, gameId, round, arg] = data.split("|");
  const action = a === undefined ? undefined : ACTIONS[a];
  if (!action || !code || !/^[A-Z0-9]{4}$/.test(code)) return null;
  const nums = [gameId, round, arg].map(Number);
  if (nums.some((n) => !Number.isInteger(n))) return null;
  return { action, code, gameId: nums[0] as number, round: nums[1] as number, arg: nums[2] as number };
}

/**
 * Settings taps travel in the numeric `arg`: 1 spy+, 2 spy−, 3 Mr. White on/off, 4 auto,
 * 5 discussion timer, 6 vote timer, 8 all themes, 10+i theme i, −1 "Chơi online".
 * 7 and 9 open and close the host's theme picker; they change nothing.
 */
export const THEMES_OPEN = 7;
export const THEMES_CLOSE = 9;
const THEME_BASE = 10;
const VOICE = -1;

export function encodeChange(change: SettingsChange): number {
  switch (change.kind) {
    case "spies":
      return change.delta > 0 ? 1 : 2;
    case "white":
      return 3;
    case "auto":
      return 4;
    case "theme":
      return THEME_BASE + PACKS.findIndex((p) => p.id === change.theme);
    case "timer":
      return change.timer === "discussion" ? 5 : 6;
    case "allThemes":
      return 8;
    case "voice":
      return VOICE;
  }
}

export function decodeChange(arg: number): SettingsChange | null {
  if (arg === 1) return { kind: "spies", delta: 1 };
  if (arg === 2) return { kind: "spies", delta: -1 };
  if (arg === 3) return { kind: "white" };
  if (arg === 4) return { kind: "auto" };
  if (arg === 5) return { kind: "timer", timer: "discussion" };
  if (arg === 6) return { kind: "timer", timer: "vote" };
  if (arg === 8) return { kind: "allThemes" };
  if (arg === VOICE) return { kind: "voice" };
  const pack = PACKS[arg - THEME_BASE];
  return arg >= THEME_BASE && pack ? { kind: "theme", theme: pack.id } : null;
}
