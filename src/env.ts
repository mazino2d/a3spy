import type { PlayerDO } from "./player/PlayerDO";
import type { RoomDO } from "./room/RoomDO";

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  /** Public, from wrangler.jsonc vars: used for Telegram invite links in rooms opened on the web. */
  TELEGRAM_BOT_USERNAME: string;
  ROOM: DurableObjectNamespace<RoomDO>;
  PLAYER: DurableObjectNamespace<PlayerDO>;
}
