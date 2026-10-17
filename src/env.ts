import type { AudienceDO } from "./audience/AudienceDO";
import type { GuestDO } from "./player/GuestDO";
import type { GameRoomDO } from "./room/GameRoomDO";
import type { LeaderboardDO } from "./stats/LeaderboardDO";

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  /** Public, from wrangler.jsonc vars: the Realtime SFU app for voice calls. */
  REALTIME_APP_ID: string;
  /** Secret; absent in local dev without voice. */
  REALTIME_APP_TOKEN?: string;
  /** Secret; the only Telegram user who may send announcements (/announce). */
  OWNER_TELEGRAM_ID?: string;
  GAME_ROOM: DurableObjectNamespace<GameRoomDO>;
  GUEST: DurableObjectNamespace<GuestDO>;
  LEADERBOARD: DurableObjectNamespace<LeaderboardDO>;
  AUDIENCE: DurableObjectNamespace<AudienceDO>;
}
