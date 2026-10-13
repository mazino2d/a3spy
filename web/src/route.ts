import type { Route } from "./parse";

export { cleanCode, parseRoute, type Route } from "./parse";

export function go(route: Route, replace = false): void {
  const path = route.name === "room" ? `/r/${route.code}` : route.name === "stats" ? "/stats" : "/";
  if (location.pathname === path) return;
  if (replace) history.replaceState(null, "", path);
  else history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
