import type { Env } from "../env";

/** The player's room, after clearing a pointer to a room that closed or dropped them. */
export async function currentRoom(env: Env, playerId: number): Promise<string | null> {
  const pointer = env.PLAYER.getByName(String(playerId));
  const code = await pointer.room();
  if (code && !(await env.ROOM.getByName(code).has(playerId))) {
    await pointer.setRoom(null);
    return null;
  }
  return code;
}
