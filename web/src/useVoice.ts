import { useEffect, useRef, useState } from "preact/hooks";
import type { VoiceMember } from "../../src/voice/roster";
import type { ServerMessage, VoiceMessage } from "../../src/web/protocol";
import type { SocketStatus } from "./api";
import { VoiceCall, type VoiceState, voiceMark } from "./voice";

const NO_CALL: VoiceState = { status: "idle", muted: false, listenOnly: false, talking: new Set() };

export interface Voice {
  on: boolean;
  members: VoiceMember[];
  call: VoiceState;
  /** Feed every socket message; true when it was a voice message. */
  onMessage(m: ServerMessage): boolean;
  join(me: number): void;
  setMuted(muted: boolean): void;
  leave(): void;
  mark(id: number): string;
}

/** The room's voice call for one screen: who is in it, and this device's side of it. */
export function useVoice(send: (m: VoiceMessage) => boolean, status: SocketStatus): Voice {
  const [roster, setRoster] = useState<{ on: boolean; members: VoiceMember[] }>({ on: false, members: [] });
  const [call, setCall] = useState<VoiceState>(NO_CALL);
  const ref = useRef<VoiceCall | null>(null);

  // Audio keeps flowing through a socket drop; the call resumes its seat when the socket is back.
  useEffect(() => ref.current?.onSocket(status), [status]);
  useEffect(
    () => () => {
      ref.current?.leave();
      ref.current = null;
    },
    [],
  );

  return {
    ...roster,
    call,
    onMessage(m) {
      if (m.type !== "voice" && m.type !== "voiceSdp" && m.type !== "voiceError") return false;
      if (m.type === "voice") setRoster({ on: m.on, members: m.members });
      void ref.current?.onMessage(m);
      return true;
    },
    join(me) {
      ref.current ??= new VoiceCall(me, send, setCall);
      void ref.current.join();
    },
    setMuted: (muted) => ref.current?.setMuted(muted),
    leave: () => ref.current?.leave(),
    mark: (id) => (roster.on ? voiceMark(roster.members, call.talking, id) : ""),
  };
}
