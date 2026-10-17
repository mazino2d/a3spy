import type { PlayerDO } from "./player/PlayerDO";
import type { RoomDO } from "./room/RoomDO";
import type { StatsDO } from "./stats/StatsDO";

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  /** Public, from wrangler.jsonc vars: used for Telegram invite links in rooms opened on the web. */
  TELEGRAM_BOT_USERNAME: string;
  /** Public, from wrangler.jsonc vars: the Realtime SFU app for voice calls. */
  REALTIME_APP_ID: string;
  /** Secret; absent in local dev without voice. */
  REALTIME_APP_TOKEN?: string;
  ROOM: DurableObjectNamespace<RoomDO>;
  PLAYER: DurableObjectNamespace<PlayerDO>;
  STATS: DurableObjectNamespace<StatsDO>;
}
