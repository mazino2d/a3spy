import { useEffect, useState } from "preact/hooks";
import { ApiError, joinRoom, leaveRoom, type Me } from "../api";
import { t } from "../messages";
import { go } from "../route";
import { Loading } from "./Loading";
import { Room } from "./Room";

type Gate = { kind: "joining" } | { kind: "in" } | { kind: "other"; room: string } | { kind: "error"; text: string };

/** Gets the player into the room in the URL, never into two rooms at once. */
export function RoomGate({ code, me, onMe }: { code: string; me: Me; onMe(me: Me): void }) {
  const [gate, setGate] = useState<Gate>({ kind: "joining" });

  const enter = async () => {
    setGate({ kind: "joining" });
    try {
      await joinRoom(code);
      onMe({ ...me, room: code });
      setGate({ kind: "in" });
    } catch (e) {
      if (e instanceof ApiError && e.code === "in_other_room" && e.room) setGate({ kind: "other", room: e.room });
      else if (e instanceof ApiError && e.status === 404) setGate({ kind: "error", text: t.roomNotFound });
      else setGate({ kind: "error", text: t.network });
    }
  };

  // Joining a room you are already in is a no-op, and it also catches a room that closed meanwhile.
  useEffect(() => {
    void enter();
  }, [code]);

  switch (gate.kind) {
    case "in":
      return (
        <Room
          code={code}
          onLeft={() => {
            onMe({ ...me, room: null });
            go({ name: "home" });
          }}
        />
      );
    case "joining":
      return <Loading />;
    case "other":
      return (
        <main class="screen center stack">
          <p>{t.inOtherRoom(gate.room)}</p>
          <button type="button" class="primary" onClick={() => go({ name: "room", code: gate.room })}>
            {t.backToRoom(gate.room)}
          </button>
          <button
            type="button"
            class="secondary"
            onClick={async () => {
              await leaveRoom(gate.room).catch(() => undefined);
              await enter();
            }}
          >
            {t.leaveAndJoin(code)}
          </button>
        </main>
      );
    case "error":
      return (
        <main class="screen center stack">
          <p class="error">{gate.text}</p>
          <button type="button" class="secondary" onClick={() => go({ name: "home" })}>
            {t.backHome}
          </button>
        </main>
      );
  }
}
