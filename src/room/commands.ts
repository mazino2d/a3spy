import * as engine from "../game/engine";
import type { Rng } from "../game/rng";
import type { WordPair } from "../game/roles";

/**
 * A player's command, whatever client it came from. Telegram buttons and web
 * messages both become one of these, so phase, host and stale checks are the
 * same on every client.
 */
export type Command =
  | { action: "start" | "leave" }
  | { action: "again" | "openVote" | "closeVote"; gameId: number; round: number }
  /** gameId is absent for `/end`, which always targets the current game. */
  | { action: "end"; gameId?: number }
  | { action: "vote"; gameId: number; round: number; target: number }
  | { action: "guess"; text: string }
  | { action: "configure"; change: engine.SettingsChange };

export interface Deps {
  rng: Rng;
  /** Pairs of the given themes; every theme when empty. */
  pairs(themes: readonly string[]): readonly WordPair[];
  /** Every theme id, in display order. */
  themes: readonly string[];
  now: number;
}

const fail = (error: engine.GameError): engine.Result => ({ ok: false, error });

export function decide(room: engine.Room, playerId: number, cmd: Command, deps: Deps): engine.Result {
  const startOptions = () => ({ rng: deps.rng, pairs: deps.pairs(room.settings.themes), now: deps.now });
  switch (cmd.action) {
    case "start":
      if (engine.isRunning(room)) return fail("game_running");
      return engine.start(room, playerId, startOptions());
    case "again":
      if (room.game?.id !== cmd.gameId) return fail("stale");
      return engine.start(room, playerId, startOptions());
    case "configure":
      return engine.configure(room, playerId, cmd.change, deps.themes);
    case "leave":
      return engine.leave(room, playerId);
    case "openVote":
      return engine.openVote(room, playerId, cmd);
    case "closeVote":
      return engine.closeVote(room, playerId, cmd);
    case "vote":
      return engine.vote(room, playerId, cmd.target, cmd);
    case "end":
      if (cmd.gameId !== undefined && room.game?.id !== cmd.gameId) return fail("stale");
      return engine.end(room, playerId);
    case "guess":
      return engine.guess(room, playerId, cmd.text);
  }
}
