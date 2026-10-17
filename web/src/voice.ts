import type { VoiceMember } from "../../src/voice/roster";
import type { ServerMessage, VoiceMessage } from "../../src/web/protocol";

/**
 * This device's side of the room's voice call: one RTCPeerConnection to Cloudflare's SFU
 * that sends the microphone and receives one track per other player. The room socket
 * carries the signaling; see docs/implementations/M6-remote-voice.md.
 */

export type VoiceStatus = "idle" | "connecting" | "in" | "failed";

export interface VoiceState {
  status: VoiceStatus;
  muted: boolean;
  /** In the call without a microphone (access denied): can listen, never heard. */
  listenOnly: boolean;
  /** Players heard talking right now, this device included. */
  talking: ReadonlySet<number>;
}

const ICE: RTCConfiguration = { iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }], bundlePolicy: "max-bundle" };
/** Audio level (0–1) above which a player counts as talking. */
const TALKING = 0.03;
const METER_MS = 250;

interface Remote {
  id: number;
  mid: string;
  audio: HTMLAudioElement;
}

export class VoiceCall {
  private pc: RTCPeerConnection | null = null;
  private mic: MediaStreamTrack | null = null;
  private meter: ReturnType<typeof setInterval> | undefined;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  /** Received tracks, by member key. */
  private remotes = new Map<string, Remote>();
  private members: VoiceMember[] = [];
  /** A join or pull waiting for the room's voiceSdp; one exchange at a time. */
  private waiting: "join" | "pull" | null = null;
  private state: VoiceState = { status: "idle", muted: false, listenOnly: false, talking: new Set() };

  constructor(
    private readonly me: number,
    private readonly send: (m: VoiceMessage) => boolean,
    private readonly onChange: (s: VoiceState) => void,
  ) {}

  get current(): VoiceState {
    return this.state;
  }

  /** Must run from a tap: browsers only allow the microphone and audio playback after one. */
  async join(): Promise<void> {
    if (this.state.status === "connecting" || this.state.status === "in") return;
    this.set({ status: "connecting", muted: false, listenOnly: false });
    try {
      this.mic = (
        await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        })
      ).getAudioTracks()[0] as MediaStreamTrack;
    } catch {
      // No microphone: join to listen (AC12). The send transceiver carries nothing.
      this.mic = null;
    }
    try {
      const pc = new RTCPeerConnection(ICE);
      this.pc = pc;
      const sender = pc.addTransceiver(this.mic ?? "audio", { direction: "sendonly" });
      await pc.setLocalDescription(await pc.createOffer());
      if (!pc.localDescription || !sender.mid) throw new Error("no offer");
      this.startMeter();
      this.waiting = "join";
      if (!this.send({ type: "voice", op: "join", sdp: pc.localDescription.sdp, mid: sender.mid }))
        throw new Error("offline");
      this.set({ listenOnly: this.mic === null, muted: this.mic === null });
    } catch {
      this.hangup("failed");
    }
  }

  setMuted(muted: boolean): void {
    if (this.state.status !== "in" || !this.mic) return;
    this.mic.enabled = !muted;
    this.send({ type: "voice", op: "mute", muted });
    this.set({ muted });
  }

  leave(): void {
    if (this.state.status === "idle") return;
    this.send({ type: "voice", op: "leave" });
    this.hangup("idle");
  }

  /** Drops the call on this device only, e.g. when the room socket is lost. */
  hangup(status: "idle" | "failed" = "idle"): void {
    clearInterval(this.meter);
    this.mic?.stop();
    this.mic = null;
    this.pc?.close();
    this.pc = null;
    for (const r of this.remotes.values()) r.audio.srcObject = null;
    this.remotes.clear();
    void this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
    this.analyser = null;
    this.waiting = null;
    this.set({ status, muted: false, listenOnly: false, talking: new Set() });
  }

  /** Feed every voice message from the room socket. */
  async onMessage(m: ServerMessage): Promise<void> {
    if (m.type === "voice") {
      this.members = m.members;
      if (!m.on && this.state.status !== "idle") return this.hangup("idle");
      return this.sync();
    }
    if (m.type === "voiceError") {
      if (m.code === "voice_off") return this.hangup("idle");
      if (this.waiting === "join" || m.code === "not_in_call") return this.hangup("failed");
      this.waiting = null;
      return;
    }
    if (m.type !== "voiceSdp" || !this.pc) return;
    const pc = this.pc;
    try {
      if (this.waiting === "join") {
        if (m.sdp) await pc.setRemoteDescription(m.sdp);
        this.waiting = null;
        this.set({ status: "in" });
        // Listening without a microphone: everyone sees this player as muted.
        if (this.state.listenOnly) this.send({ type: "voice", op: "mute", muted: true });
      } else if (this.waiting === "pull") {
        if (m.sdp) {
          await pc.setRemoteDescription(m.sdp);
          await pc.setLocalDescription(await pc.createAnswer());
          if (pc.localDescription) this.send({ type: "voice", op: "answer", sdp: pc.localDescription.sdp });
        }
        for (const t of m.tracks) this.attach(t.id, t.key, t.mid);
        this.waiting = null;
      }
    } catch {
      return this.hangup("failed");
    }
    return this.sync();
  }

  /** Receives everyone in the call this device is not hearing yet; stops those who left. */
  private sync(): void {
    if (this.state.status !== "in" || this.waiting) return;
    const others = this.members.filter((x) => x.id !== this.me);
    const keys = new Set(others.map((x) => x.key));
    for (const [key, r] of this.remotes) {
      if (keys.has(key)) continue;
      r.audio.srcObject = null;
      this.remotes.delete(key);
    }
    const missing = others.filter((x) => !this.remotes.has(x.key)).map((x) => x.id);
    if (!missing.length) return;
    this.waiting = "pull";
    if (!this.send({ type: "voice", op: "pull", ids: missing })) this.waiting = null;
  }

  private attach(id: number, key: string, mid: string): void {
    const transceiver = this.pc?.getTransceivers().find((t) => t.mid === mid);
    if (!transceiver) return;
    const audio = new Audio();
    audio.autoplay = true;
    audio.srcObject = new MediaStream([transceiver.receiver.track]);
    void audio.play().catch(() => {});
    this.remotes.set(key, { id, mid, audio });
  }

  /** "Talking" comes from audio levels on this device; nothing is sent to the server. */
  private startMeter(): void {
    if (this.mic) {
      try {
        this.audioCtx = new AudioContext();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 512;
        this.audioCtx.createMediaStreamSource(new MediaStream([this.mic])).connect(this.analyser);
      } catch {
        this.analyser = null;
      }
    }
    const samples = new Float32Array(512);
    this.meter = setInterval(() => {
      const talking = new Set<number>();
      if (this.analyser && !this.state.muted) {
        this.analyser.getFloatTimeDomainData(samples);
        const rms = Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
        if (rms > TALKING) talking.add(this.me);
      }
      for (const r of this.remotes.values()) {
        const t = this.pc?.getTransceivers().find((x) => x.mid === r.mid);
        const level = t?.receiver.getSynchronizationSources()[0]?.audioLevel ?? 0;
        if (level > TALKING) talking.add(r.id);
      }
      const before = this.state.talking;
      if (talking.size !== before.size || [...talking].some((id) => !before.has(id))) this.set({ talking });
    }, METER_MS);
  }

  private set(patch: Partial<VoiceState>): void {
    this.state = { ...this.state, ...patch };
    this.onChange(this.state);
  }
}

/** The mark shown after a player's name: talking, muted, or in the call. */
export function voiceMark(members: VoiceMember[], talking: ReadonlySet<number>, id: number): string {
  const m = members.find((x) => x.id === id);
  if (!m) return "";
  if (m.muted) return " 🔇";
  return talking.has(id) ? " 🗣" : " 🎙";
}
