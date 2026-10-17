import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";

/**
 * One per web guest: their name, the SHA-256 of their session token, and which room they are
 * in. GameRoomDO is the source of truth for the room and keeps this in sync.
 */
export class GuestDO extends DurableObject<Env> {
  room(): string | null {
    return this.ctx.storage.kv.get<string>("room") ?? null;
  }

  setRoom(code: string | null): void {
    if (code === null) this.ctx.storage.kv.delete("room");
    else this.ctx.storage.kv.put("room", code);
  }

  /** Registers a web guest. Returns false if the ID is already taken. */
  createGuest(name: string, tokenHash: string): boolean {
    if (this.ctx.storage.kv.get("token") !== undefined) return false;
    this.ctx.storage.kv.put("token", tokenHash);
    this.ctx.storage.kv.put("name", name);
    return true;
  }

  /** The guest's name when the token matches, else null. */
  verify(tokenHash: string): string | null {
    const stored = this.ctx.storage.kv.get<string>("token");
    if (stored === undefined || stored !== tokenHash) return null;
    return this.ctx.storage.kv.get<string>("name") ?? null;
  }

  rename(name: string): void {
    this.ctx.storage.kv.put("name", name);
  }
}
