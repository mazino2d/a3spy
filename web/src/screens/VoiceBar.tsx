import { useEffect, useState } from "preact/hooks";
import { t } from "../messages";
import { recall, remember } from "../storage";
import type { VoiceState } from "../voice";

const TIP_KEY = "a3spy.voiceTip";

interface Props {
  call: VoiceState;
  /** People in the call, this device included once it has joined. */
  count: number;
  online: boolean;
  onJoin(): void;
  onMute(muted: boolean): void;
  onLeave(): void;
}

/** The room's voice call, at the top of every room screen while "Chơi online" is on. */
export function VoiceBar({ call, count, online, onJoin, onMute, onLeave }: Props) {
  const [tip, setTip] = useState(false);

  // The headphones tip shows during the first call on this device only (AC16).
  useEffect(() => {
    if (call.status !== "in" || recall(TIP_KEY)) return;
    remember(TIP_KEY, "1");
    setTip(true);
  }, [call.status]);

  return (
    <section class="voicebar" aria-label={t.voice}>
      {call.status === "in" || call.status === "reconnecting" ? (
        <>
          <span class="small">
            {call.status === "reconnecting"
              ? t.voiceReconnecting
              : call.listenOnly
                ? t.voiceListenOnly
                : t.voiceInCall(count)}
          </span>
          <span class="row">
            {!call.listenOnly && call.status === "in" && (
              <button
                type="button"
                class={call.muted ? "chip on" : "chip"}
                aria-pressed={call.muted}
                onClick={() => onMute(!call.muted)}
              >
                {call.muted ? t.voiceUnmute : t.voiceMute}
              </button>
            )}
            <button type="button" class="link small" onClick={onLeave}>
              {t.voiceLeave}
            </button>
          </span>
        </>
      ) : (
        <>
          <span class="small">
            {call.status === "connecting"
              ? t.voiceConnecting
              : call.status === "failed"
                ? t.voiceFailed
                : t.voiceCount(count)}
          </span>
          <button type="button" class="primary" disabled={!online || call.status === "connecting"} onClick={onJoin}>
            {t.voiceJoin}
          </button>
        </>
      )}
      {call.status === "in" && call.listenOnly && <p class="small muted full">{t.voiceDenied}</p>}
      {tip && <p class="small muted full">{t.voiceTip}</p>}
    </section>
  );
}
