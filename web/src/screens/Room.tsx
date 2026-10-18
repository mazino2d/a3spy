import { useEffect, useRef, useState } from "preact/hooks";
import type { PublicEvent, RoomView } from "../../../src/game/view";
import type { CommandMessage, Links, ServerMessage } from "../../../src/web/protocol";
import { leaveRoom, RoomSocket, type SocketStatus } from "../api";
import { t } from "../messages";
import { nextOutcome } from "../outcome";
import { go } from "../route";
import { useVoice } from "../useVoice";
import { Game, GameOver, Scoreboard } from "./Game";
import { Loading } from "./Loading";
import { Lobby } from "./Lobby";
import { VoiceBar } from "./VoiceBar";

export interface RoomProps {
  view: RoomView;
  links: Links;
  /** False while disconnected: actions are disabled rather than lost. */
  online: boolean;
  send(message: CommandMessage): void;
  /** Voice mark after a player's name (" 🎙", " 🔇", " 🗣"), or "" when they are not in the call. */
  mark(id: number): string;
}

/** One live room: the socket, the latest state, and which screen to show. */
export function Room({ code, onLeft }: { code: string; onLeft(): void }) {
  const [state, setState] = useState<{ view: RoomView; links: Links } | null>(null);
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const [closed, setClosed] = useState<"left" | "closed" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<PublicEvent[]>([]);
  const [scoreOpen, setScoreOpen] = useState(false);
  const socket = useRef<RoomSocket | null>(null);
  const voice = useVoice((m) => socket.current?.send(m) ?? false, status);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  useEffect(() => {
    const onMessage = (m: ServerMessage) => {
      if (m.type === "voiceError" && m.code === "unavailable") setToast(t.voiceFailed);
      if (voiceRef.current.onMessage(m)) return;
      if (m.type === "state") setState({ view: m.view, links: m.links });
      else if (m.type === "events") setOutcome((current) => nextOutcome(current, m.events));
      else if (m.type === "error") setToast(t.errors[m.code] ?? t.errors.generic ?? "");
      else if (m.type === "closed" && m.reason !== "replaced") setClosed(m.reason);
    };
    const s = new RoomSocket(code, onMessage, setStatus);
    socket.current = s;
    return () => s.close();
  }, [code]);

  useEffect(() => {
    if (closed === "left") onLeft();
  }, [closed]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (closed === "closed" || (status === "closed" && closed === null))
    return (
      <main class="screen center stack">
        <p>{t.roomClosed}</p>
        <button type="button" class="primary" onClick={onLeft}>
          {t.backHome}
        </button>
      </main>
    );

  if (status === "replaced")
    return (
      <main class="screen center stack">
        <p>{t.replaced}</p>
        <button type="button" class="primary" onClick={() => socket.current?.resume()}>
          {t.useHere}
        </button>
        <button type="button" class="secondary" onClick={() => go({ name: "home" })}>
          {t.backHome}
        </button>
      </main>
    );

  if (!state) return <Loading />;

  const online = status === "open";
  const props: RoomProps = {
    mark: voice.mark,
    view: state.view,
    links: state.links,
    online,
    send: (message) => {
      if (message.action === "leave" && !socket.current?.send(message)) {
        // Offline: leave over HTTP so the player is never stuck in a room.
        void leaveRoom(code).finally(onLeft);
        return;
      }
      if (!socket.current?.send(message)) setToast(t.offline);
    },
  };

  return (
    <>
      {!online && (
        <div class="banner" role="status">
          {t.offline}
        </div>
      )}
      {voice.on && (
        <VoiceBar
          call={voice.call}
          count={voice.members.length}
          online={online}
          onJoin={() => voice.join(state.view.me)}
          onMute={voice.setMuted}
          onLeave={voice.leave}
        />
      )}
      {!state.view.game ? (
        <Lobby {...props} />
      ) : state.view.game.phase === "ended" ? (
        <GameOver {...props} outcome={outcome} onScore={() => setScoreOpen(true)} />
      ) : (
        <Game {...props} outcome={outcome} onScore={() => setScoreOpen(true)} />
      )}
      {scoreOpen && <Scoreboard view={state.view} onClose={() => setScoreOpen(false)} />}
      {toast && (
        <div class="toast" role="alert">
          {toast}
        </div>
      )}
    </>
  );
}
