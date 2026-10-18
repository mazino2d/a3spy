import type { Route } from "./parse";

export { cleanCode, parseRoute, type Route } from "./parse";

export function go(route: Route, replace = false): void {
  const path =
    route.name === "room"
      ? `/r/${route.code}`
      : route.name === "stats"
        ? "/stats"
        : route.name === "rules"
          ? "/luat"
          : "/";
  if (location.pathname === path) return;
  // fromApp: the rules page offers "Quay lại" only when the app opened it.
  if (replace) history.replaceState({ fromApp: true }, "", path);
  else history.pushState({ fromApp: true }, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
