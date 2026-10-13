/**
 * Player IDs tell clients apart: Telegram user IDs are positive, web guests
 * get a random negative ID, so the engine and stored rooms need no client field.
 */
export const isTelegram = (playerId: number): boolean => playerId > 0;
export const isWeb = (playerId: number): boolean => playerId < 0;
