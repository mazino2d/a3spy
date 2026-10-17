import { inRoom, playerName, type Room } from "../game/engine";

/**
 * Who is in a room's voice call (docs/rules.md#voice). Pure. Kept by the GameRoomDO
 * next to the room, never inside the engine: the game never waits for voice.
 */

export interface Seat {
  /** Realtime SFU session of this player's device. Never sent to clients. */
  sessionId: string;
  /** Name of the audio track the device publishes; new on every join. */
  track: string;
  muted: boolean;
  /** The socket that joined or resumed, so a closed or replaced socket only affects its own seat. */
  conn: string;
  /** When the seat's socket was lost; the seat waits GRACE_MS for the device to resume. */
  lostAt?: number;
}

/** How long a seat whose socket dropped stays in the call, waiting for the device to come back. */
export const GRACE_MS = 30_000;

export type Roster = Record<number, Seat>;

/** What every player in the room sees of the call. */
export interface VoiceMember {
  id: number;
  name: string;
  muted: boolean;
  /** Their connection to the room dropped; they may come back within GRACE_MS. */
  reconnecting: boolean;
  /** Changes whenever the member joins again, so devices know to pull the new track. */
  key: string;
}

/** Seats that may stay: voice is on and the player is still in the room. */
export function prune(room: Room, roster: Roster): Roster {
  if (!room.settings.voice) return {};
  return Object.fromEntries(Object.entries(roster).filter(([id]) => inRoom(room, Number(id))));
}

export function members(room: Room, roster: Roster): VoiceMember[] {
  return Object.entries(prune(room, roster)).map(([id, seat]) => ({
    id: Number(id),
    name: playerName(room, Number(id)),
    muted: seat.muted,
    reconnecting: seat.lostAt !== undefined,
    key: seat.track,
  }));
}

/** The seats a device may pull: everyone else in the call. Unknown ids are dropped. */
export function pullable(roster: Roster, viewer: number, ids: number[]): { id: number; seat: Seat }[] {
  return [...new Set(ids)]
    .filter((id) => id !== viewer)
    .flatMap((id) => {
      const seat = roster[id];
      return seat ? [{ id, seat }] : [];
    });
}

/** Removes the seats a socket owned. */
export function dropConn(roster: Roster, conn: string): Roster {
  return Object.fromEntries(Object.entries(roster).filter(([, seat]) => seat.conn !== conn));
}

/** Marks the seats owned by a socket that closed, or by a player whose socket was replaced. */
export function markLost(roster: Roster, lost: { conn: string } | { id: number }, now: number): Roster {
  return Object.fromEntries(
    Object.entries(roster).map(([id, seat]) => {
      const hit = "conn" in lost ? seat.conn === lost.conn : Number(id) === lost.id;
      return [id, hit && seat.lostAt === undefined ? { ...seat, lostAt: now } : seat];
    }),
  );
}

/** Seats lost for GRACE_MS or longer leave the call. */
export function sweep(roster: Roster, now: number): Roster {
  return Object.fromEntries(
    Object.entries(roster).filter(([, seat]) => seat.lostAt === undefined || now - seat.lostAt < GRACE_MS),
  );
}

/** When the next lost seat must be swept, or null. */
export function nextSweep(roster: Roster): number | null {
  const due = Object.values(roster).flatMap((s) => (s.lostAt === undefined ? [] : [s.lostAt + GRACE_MS]));
  return due.length ? Math.min(...due) : null;
}

export const sameRoster = (a: Roster, b: Roster): boolean => JSON.stringify(a) === JSON.stringify(b);
