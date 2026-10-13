/** Inline button payloads: `<action>|<room>|<game>|<round>|<arg>`, well under Telegram's 64-byte limit. */

export type Action = "start" | "leave" | "openVote" | "closeVote" | "vote" | "word" | "again" | "end";

const CODES: Record<Action, string> = {
  start: "s",
  leave: "l",
  openVote: "ov",
  closeVote: "cv",
  vote: "v",
  word: "w",
  again: "a",
  end: "e",
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
