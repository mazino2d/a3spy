import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";
import { addResult, emptyStats, type GameResult, leaderboard, type PlayerStats } from "../game/stats";

/** Long-term stats for the whole group: one instance, named "group". Never stores words. */
export class LeaderboardDO extends DurableObject<Env> {
  private get(id: number): PlayerStats | undefined {
    return this.ctx.storage.kv.get<PlayerStats>(`p:${id}`);
  }

  record(results: GameResult[]): void {
    for (const r of results)
      this.ctx.storage.kv.put(`p:${r.id}`, addResult(this.get(r.id) ?? emptyStats(r.id, r.name), r));
  }

  /** How many players have stats. */
  count(): number {
    return [...this.ctx.storage.kv.list({ prefix: "p:" })].length;
  }

  /** Deletes every player's stats (owner's /resetstats). Returns how many were deleted. */
  reset(): number {
    const keys = [...this.ctx.storage.kv.list({ prefix: "p:" })].map(([key]) => key);
    for (const key of keys) this.ctx.storage.kv.delete(key);
    return keys.length;
  }

  /** The player's stats (null before their first finished game) and the group leaderboard. */
  read(id: number): { me: PlayerStats | null; board: PlayerStats[] } {
    const all = [...this.ctx.storage.kv.list<PlayerStats>({ prefix: "p:" })].map(([, s]) => s);
    return { me: this.get(id) ?? null, board: leaderboard(all) };
  }
}

export const statsOf = (env: Env) => env.LEADERBOARD.getByName("group");
