// Pure parsing, no DOM: unit-tested in test/unit/web.test.ts.

/** Two routes: "/" (home) and "/r/<code>" (a room). Codes are case-insensitive. */
export type Route = { name: "home" } | { name: "room"; code: string };

export function parseRoute(pathname: string): Route {
  const m = /^\/r\/([A-Za-z0-9]{4})\/?$/.exec(pathname);
  return m ? { name: "room", code: (m[1] as string).toUpperCase() } : { name: "home" };
}

/** Normalises what a player typed as a room code; null when it cannot be one. */
export function cleanCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9]{4}$/.test(code) ? code : null;
}
