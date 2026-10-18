/** Callback data in the format Telegram game buttons used before M7: `<action>|<room>|<game>|<round>|<arg>`. */
export const encode = (action: string, code: string, game = 0, round = 0, arg = 0) =>
  [action, code, game, round, arg].join("|");
