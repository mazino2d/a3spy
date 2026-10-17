/**
 * Web guests get a random negative ID, so it can never be mistaken for a Telegram user id
 * (positive) from the time the game also ran in Telegram.
 */
export const isWeb = (playerId: number): boolean => playerId < 0;
