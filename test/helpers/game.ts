import { createRoom, type GameEvent, type Player, type Result, type Room, start } from "../../src/game/engine";
import { seededRng } from "../../src/game/rng";
import type { Role } from "../../src/game/roles";

export const PAIRS = [
  { a: "Trà sữa", b: "Cà phê sữa" },
  { a: "Phở", b: "Bún bò" },
];

export const player = (id: number): Player => ({ id, name: `P${id}` });

export function expectOk(r: Result): { room: Room; events: GameEvent[] } {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`);
  return r;
}

/** Room with players 1..n, host 1, no game. */
export function lobby(n: number): Room {
  let room = createRoom("ABCD", player(1));
  for (let id = 2; id <= n; id++) room = { ...room, players: [...room.players, player(id)] };
  return room;
}

export function started(n: number, seed = 1, now = 0): Room {
  return expectOk(start(lobby(n), 1, { rng: seededRng(seed), pairs: PAIRS, now })).room;
}

export function idsWithRole(room: Room, role: Role): number[] {
  return (room.game?.hands ?? []).filter((h) => h.role === role).map((h) => h.playerId);
}

export const ofType = <T extends GameEvent["type"]>(events: GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

export const turnOf = (room: Room) => ({ gameId: room.game?.id ?? 0, round: room.game?.round ?? 0 });
