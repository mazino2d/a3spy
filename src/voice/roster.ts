import { inRoom, playerName, type Room } from "../game/engine";

/**
 * Who is in a room's voice call (docs/rules.md#voice). Pure. Kept by the RoomDO
 * next to the room, never inside the engine: the game never waits for voice.
 */

export interface Seat {
  /** Realtime SFU session of this player's device. Never sent to clients. */
  sessionId: string;
  /** Name of the audio track the device publishes; new on every join. */
  track: string;
  muted: boolean;
  /** The socket that joined, so a closed or replaced socket only removes its own seat. */
  conn: string;
}

export type Roster = Record<number, Seat>;

/** What every player in the room sees of the call. */
export interface VoiceMember {
  id: number;
  name: string;
  muted: boolean;
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

export const sameRoster = (a: Roster, b: Roster): boolean => JSON.stringify(a) === JSON.stringify(b);
