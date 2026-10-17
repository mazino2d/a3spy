import { useEffect, useRef, useState } from "preact/hooks";
import type { ServerMessage } from "../../../src/web/protocol";
import { getVoiceMe, RoomSocket, type SocketStatus } from "../api";
import { t } from "../messages";
import { useVoice } from "../useVoice";
import { VoiceBar } from "./VoiceBar";

/**
 * A Telegram player's voice page, opened from the bot's "Vào voice" button. It shows the call
 * and nothing else: the word, the role and the vote stay in Telegram (AC9).
 */
export function VoicePage({ code }: { code: string }) {
  const [me, setMe] = useState<{ id: number; inRoom: boolean } | null | undefined>(undefined);
  const loginFailed = new URLSearchParams(location.search).has("login");

  useEffect(() => {
    if (loginFailed) {
      setMe(null);
      return;
    }
    getVoiceMe(code)
      .then(setMe)
      .catch(() => setMe(null));
  }, [code]);

  if (me === undefined) return <main class="screen center muted">{t.connecting}</main>;
  if (me === null) return <Notice text={t.voiceLinkExpired} />;
  if (!me.inRoom) return <Notice text={t.voiceNotInRoom} />;
  return <VoiceRoom code={code} me={me.id} />;
}

function Notice({ text }: { text: string }) {
  return (
    <main class="screen center stack">
      <h1>🎙 {t.voice}</h1>
      <p>{text}</p>
    </main>
  );
}

function VoiceRoom({ code, me }: { code: string; me: number }) {
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const [closed, setClosed] = useState(false);
  const socket = useRef<RoomSocket | null>(null);
  const voice = useVoice((m) => socket.current?.send(m) ?? false, status);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  useEffect(() => {
    const onMessage = (m: ServerMessage) => {
      if (m.type === "closed" && m.reason !== "replaced") setClosed(true);
      else voiceRef.current.onMessage(m);
    };
    const s = new RoomSocket(code, onMessage, setStatus, `/api/voice/${code}/ws`);
    socket.current = s;
    return () => s.close();
  }, [code]);

  if (closed || status === "closed") return <Notice text={t.voiceNotInRoom} />;
  if (status === "replaced") return <Notice text={t.replaced} />;

  return (
    <>
      {voice.on && (
        <VoiceBar
          call={voice.call}
          count={voice.members.length}
          online={status === "open"}
          onJoin={() => voice.join(me)}
          onMute={voice.setMuted}
          onLeave={voice.leave}
        />
      )}
      <main class="screen">
        <h1>{t.voicePageTitle(code)}</h1>
        {!voice.on ? (
          <p class="muted">{t.voiceOffHere}</p>
        ) : voice.members.length ? (
          <ul class="players">
            {voice.members.map((p) => (
              <li key={p.id} class={p.id === me ? "me" : undefined}>
                {p.name}
                {voice.mark(p.id)}
                {p.id === me && <span class="muted"> ({t.you})</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p class="muted">{t.voiceEmpty}</p>
        )}
        <p class="muted small">{t.voiceTelegramHint}</p>
      </main>
    </>
  );
}
