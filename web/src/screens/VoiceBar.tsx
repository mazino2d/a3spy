import { useEffect, useState } from "preact/hooks";
import { t } from "../messages";
import { recall, remember } from "../storage";
import type { VoiceState } from "../voice";

const TIP_KEY = "a3spy.voiceTip";
/** How long a one-off hint stays under the bar (M8 AC6). */
const HINT_MS = 8000;

interface Props {
  call: VoiceState;
  /** People in the call, this device included once it has joined. */
  count: number;
  online: boolean;
  onJoin(): void;
  onMute(muted: boolean): void;
  onLeave(): void;
}

/** The room's voice call: one line at the top of every room screen while "Chơi online" is on. */
export function VoiceBar({ call, count, online, onJoin, onMute, onLeave }: Props) {
  const [hint, setHint] = useState<string | null>(null);
  const inCall = call.status === "in" || call.status === "reconnecting";

  // One-off hints under the bar: headphones on the first call on this device, or how to
  // allow the microphone. Each hides after a few seconds or a tap.
  useEffect(() => {
    if (call.status !== "in") return;
    if (call.listenOnly) setHint(t.voiceDenied);
    else if (!recall(TIP_KEY)) {
      remember(TIP_KEY, "1");
      setHint(t.voiceTip);
    }
  }, [call.status, call.listenOnly]);
  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => setHint(null), HINT_MS);
    return () => clearTimeout(timer);
  }, [hint]);

  return (
    <section class="voicebar" aria-label={t.voice}>
      <div class="row between">
        <span class="small">
          {call.status === "reconnecting"
            ? t.voiceReconnecting
            : call.status === "connecting"
              ? t.voiceConnecting
              : call.status === "failed"
                ? t.voiceFailed
                : inCall
                  ? call.listenOnly
                    ? t.voiceListenOnly
                    : t.voiceInCall(count)
                  : t.voiceCount(count)}
        </span>
        {inCall ? (
          <span class="row">
            {!call.listenOnly && call.status === "in" && (
              <button
                type="button"
                class={call.muted ? "chip compact on" : "chip compact"}
                aria-pressed={call.muted}
                aria-label={call.muted ? t.voiceUnmute : t.voiceMute}
                onClick={() => onMute(!call.muted)}
              >
                {call.muted ? "🔇" : "🎙"} {call.muted ? t.voiceUnmute : t.voiceMute}
              </button>
            )}
            <button type="button" class="link small compact" onClick={onLeave}>
              {t.voiceLeave}
            </button>
          </span>
        ) : (
          <button
            type="button"
            class="primary compact"
            disabled={!online || call.status === "connecting"}
            onClick={onJoin}
          >
            {t.voiceJoin}
          </button>
        )}
      </div>
      {hint && (
        <button type="button" class="hint small muted" onClick={() => setHint(null)}>
          {hint}
        </button>
      )}
    </section>
  );
}
