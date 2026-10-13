import { type Rng, shuffle } from "./rng";

export const MIN_PLAYERS = 3;
export const SOFT_MAX_PLAYERS = 12;

export type Role = "civilian" | "spy" | "white";

export interface RoleCounts {
  spies: number;
  white: number;
}

export interface WordPair {
  readonly a: string;
  readonly b: string;
}

export interface Hand {
  playerId: number;
  role: Role;
  /** null for Mr. White */
  word: string | null;
}

/** Default role counts by player count (docs/rules.md#default-role-counts). */
export function defaultRoleCounts(players: number): RoleCounts {
  if (players < MIN_PLAYERS)
    throw new RangeError(`need at least ${MIN_PLAYERS} players`);
  if (players <= 4) return { spies: 1, white: 0 };
  if (players <= 6) return { spies: 1, white: 1 };
  if (players <= 9) return { spies: 2, white: 1 };
  return { spies: 3, white: 1 };
}

export type CountsProblem =
  | "too_few_players"
  | "no_spy"
  | "negative"
  | "civilians_not_majority";

/** Validates host-chosen counts; null when they are playable. */
export function checkRoleCounts(
  players: number,
  counts: RoleCounts,
): CountsProblem | null {
  if (players < MIN_PLAYERS) return "too_few_players";
  if (counts.spies < 0 || counts.white < 0) return "negative";
  if (counts.spies < 1) return "no_spy";
  const civilians = players - counts.spies - counts.white;
  if (civilians <= counts.spies + counts.white) return "civilians_not_majority";
  return null;
}

/**
 * Deals roles and words. Which word of the pair goes to civilians is random,
 * so a spy cannot infer their role from the word.
 */
export function deal(
  playerIds: readonly number[],
  pair: WordPair,
  counts: RoleCounts,
  rng: Rng,
): Hand[] {
  const problem = checkRoleCounts(playerIds.length, counts);
  if (problem) throw new RangeError(problem);

  const [civilianWord, spyWord] =
    rng() < 0.5 ? [pair.a, pair.b] : [pair.b, pair.a];
  const order = shuffle(playerIds, rng);

  return order.map((playerId, i): Hand => {
    if (i < counts.spies) return { playerId, role: "spy", word: spyWord };
    if (i < counts.spies + counts.white)
      return { playerId, role: "white", word: null };
    return { playerId, role: "civilian", word: civilianWord };
  });
}
