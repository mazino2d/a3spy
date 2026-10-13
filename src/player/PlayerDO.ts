import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";

/** One per Telegram user: which room they are in. RoomDO is the source of truth and keeps this in sync. */
export class PlayerDO extends DurableObject<Env> {
  room(): string | null {
    return this.ctx.storage.kv.get<string>("room") ?? null;
  }

  setRoom(code: string | null): void {
    if (code === null) this.ctx.storage.kv.delete("room");
    else this.ctx.storage.kv.put("room", code);
  }
}
