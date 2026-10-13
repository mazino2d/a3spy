import { type Game, winners } from "./engine";
import type { Role } from "./roles";

/**
 * Long-term stats (docs/product/specs/M5-long-term-stats.md). Pure: the stats Durable
 * Object stores one PlayerStats per player and applies GameResults to it. No words here.
 */

export interface PlayerStats {
  id: number;
  name: string;
  games: number;
  wins: number;
  spy: { games: number; wins: number };
  white: { games: number; wins: number; correct: number };
}

export interface GameResult {
  id: number;
  name: string;
  role: Role;
  won: boolean;
  /** Mr. White guessed the civilians' word. */
  guessed: boolean;
}

/** One result per player dealt into a game that ended with a winner; none for a game ended early. */
export function gameResults(game: Game): GameResult[] {
  if (game.phase !== "ended" || game.winner === null) return [];
  const won = new Set(winners(game));
  return game.hands.map((h) => ({
    id: h.playerId,
    name: game.names[h.playerId] ?? String(h.playerId),
    role: h.role,
    won: won.has(h.playerId),
    guessed: h.role === "white" && game.winner === "white",
  }));
}

export const emptyStats = (id: number, name: string): PlayerStats => ({
  id,
  name,
  games: 0,
  wins: 0,
  spy: { games: 0, wins: 0 },
  white: { games: 0, wins: 0, correct: 0 },
});

export function addResult(stats: PlayerStats, r: GameResult): PlayerStats {
  const win = r.won ? 1 : 0;
  return {
    ...stats,
    name: r.name,
    games: stats.games + 1,
    wins: stats.wins + win,
    spy: r.role === "spy" ? { games: stats.spy.games + 1, wins: stats.spy.wins + win } : stats.spy,
    white:
      r.role === "white"
        ? {
            games: stats.white.games + 1,
            wins: stats.white.wins + win,
            correct: stats.white.correct + (r.guessed ? 1 : 0),
          }
        : stats.white,
  };
}

export const winRate = (s: Pick<PlayerStats, "games" | "wins">): number => (s.games ? s.wins / s.games : 0);

/** Top players by wins, then win rate, then fewer games. */
export function leaderboard(all: readonly PlayerStats[], limit = 10): PlayerStats[] {
  return [...all]
    .filter((s) => s.games > 0)
    .sort((a, b) => b.wins - a.wins || winRate(b) - winRate(a) || a.games - b.games)
    .slice(0, limit);
}
