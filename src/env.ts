import type { PlayerDO } from "./player/PlayerDO";
import type { RoomDO } from "./room/RoomDO";

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  ROOM: DurableObjectNamespace<RoomDO>;
  PLAYER: DurableObjectNamespace<PlayerDO>;
}
