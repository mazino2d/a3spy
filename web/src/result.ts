import type { Role } from "../../src/game/roles";
import type { RoomView } from "../../src/game/view";

// Pure, no DOM: unit-tested in test/unit/web.test.ts. Built only from what every player's
// screen already shows once a game has ended (M8 AC15).

/** Why the game ended (M8 AC12). */
export type Reason = "civilians" | "spies" | "white" | "ended";

/** Mr. White plays with the spies unless he wins alone by guessing the word. */
const sideOf: Record<Role, "civilians" | "spies"> = { civilian: "civilians", spy: "spies", white: "spies" };

export function endReason(view: RoomView): Reason | null {
  const game = view.game;
  if (game?.phase !== "ended") return null;
  return game.winner ?? "ended";
}

/** The viewer's own result, or null when they were not dealt in or nobody won (M8 AC11). */
export function personal(view: RoomView): { won: boolean; role: Role } | null {
  const game = view.game;
  const role = game?.roles[view.me];
  if (game?.phase !== "ended" || !game.winner || !role) return null;
  const won = game.winner === "white" ? role === "white" : sideOf[role] === game.winner;
  return { won, role };
}

export interface ShareCard {
  winner: "civilians" | "spies" | "white";
  words: { civilian: string; spy: string };
  players: { name: string; role: Role; out: boolean; me: boolean }[];
  mine: { won: boolean; role: Role } | null;
  code: string;
  gameId: number;
}

/** What the result image shows; null unless the game ended with a winner (M8 AC14, AC15). */
export function shareCard(view: RoomView): ShareCard | null {
  const game = view.game;
  if (game?.phase !== "ended" || !game.winner || !game.words) return null;
  return {
    winner: game.winner,
    words: game.words,
    players: game.dealt.flatMap((p) => {
      const role = game.roles[p.id];
      return role ? [{ name: p.name, role, out: !game.alive.includes(p.id), me: p.id === view.me }] : [];
    }),
    mine: personal(view),
    code: view.code,
    gameId: game.id,
  };
}
