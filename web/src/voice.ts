import type { VoiceMember } from "../../src/voice/roster";
import type { ServerMessage, VoiceMessage } from "../../src/web/protocol";
import type { SocketStatus } from "./api";

/**
 * This device's side of the room's voice call: one RTCPeerConnection to Cloudflare's SFU
 * that sends the microphone and receives one track per other player. The room socket
 * carries the signaling; see docs/implementations/M6-remote-voice.md.
 *
 * Audio flows straight to the SFU, so a dropped room socket does not stop it: the call
 * keeps playing and the device resumes its seat when the socket is back. Only a failed
 * media connection makes the device join again, with a new session.
 */

export type VoiceStatus = "idle" | "connecting" | "in" | "reconnecting" | "failed";

export interface VoiceState {
  status: VoiceStatus;
  muted: boolean;
  /** In the call without a microphone (access denied): can listen, never heard. */
  listenOnly: boolean;
  /** Players heard talking right now, this device included. */
  talking: ReadonlySet<number>;
}

const ICE: RTCConfiguration = { iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }], bundlePolicy: "max-bundle" };
/** Audio level (0–1, linear) above which a player counts as talking: about −40 dBov. */
const TALKING = 0.01;
/** A player stays marked as talking this long after their last loud sample, so the mark does not flicker. */
const TALKING_HOLD_MS = 600;
const METER_MS = 200;

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
  /** This device's own track name, once the room lists it; needed to resume. */
  private myKey: string | null = null;
  /** The player wants to be in the call: survives drops, cleared only by leaving. */
  private wanted = false;
  /** The exchange waiting for the room's answer; one at a time. */
  private waiting: "join" | "pull" | "resume" | null = null;
  private lastLoud = new Map<number, number>();
  private state: VoiceState = { status: "idle", muted: false, listenOnly: false, talking: new Set() };

  constructor(
    private readonly me: number,
    private readonly send: (m: VoiceMessage) => boolean,
    private readonly onChange: (s: VoiceState) => void,
  ) {}

  /** The first time, from a tap: browsers allow the microphone and audio playback only after one. */
  async join(): Promise<void> {
    if (this.pc || this.state.status === "connecting") return;
    this.wanted = true;
    const muted = this.state.muted;
    this.set({ status: "connecting" });
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
    if (!this.wanted) return this.stop();
    try {
      const pc = new RTCPeerConnection(ICE);
      this.pc = pc;
      // The media path itself failed (network change, NAT timeout): start over with a new session.
      pc.onconnectionstatechange = () => {
        if (pc === this.pc && pc.connectionState === "failed") void this.rejoin();
      };
      const sender = pc.addTransceiver(this.mic ?? "audio", { direction: "sendonly" });
      await pc.setLocalDescription(await pc.createOffer());
      if (!pc.localDescription || !sender.mid) throw new Error("no offer");
      if (this.mic) this.mic.enabled = !muted;
      this.startMeter();
      this.myKey = null;
      this.waiting = "join";
      if (!this.send({ type: "voice", op: "join", sdp: pc.localDescription.sdp, mid: sender.mid }))
        throw new Error("offline");
      this.set({ listenOnly: this.mic === null, muted: this.mic === null || muted });
    } catch {
      this.stop("failed");
    }
  }

  setMuted(muted: boolean): void {
    if (this.state.status !== "in" || !this.mic) return;
    this.mic.enabled = !muted;
    this.send({ type: "voice", op: "mute", muted });
    this.set({ muted });
  }

  leave(): void {
    this.wanted = false;
    if (this.state.status === "idle") return;
    this.send({ type: "voice", op: "leave" });
    this.stop();
  }

  /** Follow the room socket: keep the call through drops, resume the seat when it is back. */
  onSocket(status: SocketStatus): void {
    if (status === "replaced" || status === "closed") {
      // Another tab took the seat, or the room is gone: this device is out of the call.
      this.wanted = false;
      this.stop();
      return;
    }
    if (!this.wanted) return;
    if (status !== "open") {
      if (this.state.status === "in") this.set({ status: "reconnecting" });
      return;
    }
    if (!this.pc) return void this.join();
    // A join whose answer was lost with the socket cannot be resumed: start over.
    if (this.waiting === "join" || !this.myKey) return void this.rejoin();
    this.waiting = "resume";
    this.send({ type: "voice", op: "resume", key: this.myKey });
  }

  /** Feed every voice message from the room socket. */
  async onMessage(m: ServerMessage): Promise<void> {
    if (m.type === "voice") {
      this.members = m.members;
      const mine = m.members.find((x) => x.id === this.me);
      if (mine && this.waiting !== "join") this.myKey = mine.key;
      if (!m.on && this.state.status !== "idle") {
        this.wanted = false;
        return this.stop();
      }
      if (this.waiting === "resume" && mine && !mine.reconnecting) {
        this.waiting = null;
        this.set({ status: "in" });
      }
      return this.sync();
    }
    if (m.type === "voiceError") {
      if (m.code === "voice_off") {
        this.wanted = false;
        return this.stop();
      }
      // The seat was swept while away, or a join failed: join again from scratch.
      if (this.waiting === "resume" || m.code === "not_in_call") return this.rejoin();
      if (this.waiting === "join") return this.stop("failed");
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
        // Keep the mute state across a rejoin; without a microphone everyone sees this player as muted.
        if (this.state.muted) this.send({ type: "voice", op: "mute", muted: true });
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
      return this.rejoin();
    }
    return this.sync();
  }

  /** Drops this device's media and starts a new session, keeping the player's intent and mute. */
  private async rejoin(): Promise<void> {
    if (!this.wanted) return;
    this.stop("reconnecting");
    await this.join();
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

  /** Releases the microphone, the connection and every player's audio on this device. */
  private stop(status: VoiceStatus = "idle"): void {
    clearInterval(this.meter);
    this.mic?.stop();
    this.mic = null;
    if (this.pc) this.pc.onconnectionstatechange = null;
    this.pc?.close();
    this.pc = null;
    for (const r of this.remotes.values()) r.audio.srcObject = null;
    this.remotes.clear();
    void this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
    this.analyser = null;
    this.waiting = null;
    this.lastLoud.clear();
    const keepMute = status === "reconnecting" ? this.state.muted : false;
    this.set({ status, muted: keepMute, listenOnly: false, talking: new Set() });
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
      const now = performance.now();
      if (this.analyser && !this.state.muted) {
        this.analyser.getFloatTimeDomainData(samples);
        const rms = Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
        if (rms > TALKING) this.lastLoud.set(this.me, now);
      }
      for (const r of this.remotes.values()) {
        const t = this.pc?.getTransceivers().find((x) => x.mid === r.mid);
        const level = t?.receiver.getSynchronizationSources()[0]?.audioLevel ?? 0;
        if (level > TALKING) this.lastLoud.set(r.id, now);
      }
      const talking = new Set([...this.lastLoud].filter(([, at]) => now - at < TALKING_HOLD_MS).map(([id]) => id));
      const before = this.state.talking;
      if (talking.size !== before.size || [...talking].some((id) => !before.has(id))) this.set({ talking });
    }, METER_MS);
  }

  private set(patch: Partial<VoiceState>): void {
    this.state = { ...this.state, ...patch };
    this.onChange(this.state);
  }
}

/** The mark shown after a player's name: reconnecting, muted, talking, or in the call. */
export function voiceMark(members: VoiceMember[], talking: ReadonlySet<number>, id: number): string {
  const m = members.find((x) => x.id === id);
  if (!m) return "";
  if (m.reconnecting) return " ⏳";
  if (m.muted) return " 🔇";
  return talking.has(id) ? " 🗣" : " 🎙";
}
