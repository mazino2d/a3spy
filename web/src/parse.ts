// Pure parsing, no DOM: unit-tested in test/unit/web.test.ts.

/** Routes: "/" (home), "/r/<code>" (a room, case-insensitive), "/stats" (long-term stats), "/luat" (rules). */
export type Route = { name: "home" } | { name: "room"; code: string } | { name: "stats" } | { name: "rules" };

export function parseRoute(pathname: string): Route {
  if (/^\/stats\/?$/.test(pathname)) return { name: "stats" };
  if (/^\/luat\/?$/.test(pathname)) return { name: "rules" };
  const m = /^\/r\/([A-Za-z0-9]{4})\/?$/.exec(pathname);
  return m ? { name: "room", code: (m[1] as string).toUpperCase() } : { name: "home" };
}

/** Normalises what a player typed as a room code; null when it cannot be one. */
export function cleanCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9]{4}$/.test(code) ? code : null;
}
