import { useEffect, useState } from "preact/hooks";
import { getMe, type Me } from "./api";
import { t } from "./messages";
import { go, parseRoute, type Route } from "./route";
import { Home } from "./screens/Home";
import { NameScreen } from "./screens/NameScreen";
import { RoomGate } from "./screens/RoomGate";
import { StatsScreen } from "./screens/Stats";
import { VoicePage } from "./screens/VoicePage";

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.pathname));
  /** undefined while loading; null when this device has no session yet. */
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const load = () => {
    setFailed(false);
    getMe()
      .then(setMe)
      .catch(() => setFailed(true));
  };
  useEffect(load, []);

  // An installed app opens on "/": take a player who is still in a room straight back to it.
  useEffect(() => {
    if (route.name === "home" && me?.room) go({ name: "room", code: me.room }, true);
  }, [route.name, me?.room]);

  // A Telegram player's voice page needs no web session.
  if (route.name === "voice") return <VoicePage code={route.code} />;
  if (failed)
    return (
      <main class="screen center">
        <p>{t.network}</p>
        <button type="button" class="primary" onClick={load}>
          {t.next}
        </button>
      </main>
    );
  if (me === undefined) return <main class="screen center muted">{t.connecting}</main>;
  const renaming = route.name === "home" && new URLSearchParams(location.search).has("name");
  if (me === null || renaming)
    return (
      <NameScreen
        initial={me?.name ?? ""}
        joining={route.name === "room" ? route.code : null}
        onDone={(g) => setMe({ id: g.id, name: g.name, room: me?.room ?? null })}
      />
    );
  if (route.name === "room") return <RoomGate code={route.code} me={me} onMe={setMe} />;
  if (route.name === "stats") return <StatsScreen me={me} />;
  return <Home me={me} />;
}
