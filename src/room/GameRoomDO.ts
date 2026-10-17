import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";
import * as engine from "../game/engine";
import { cryptoRng } from "../game/rng";
import { gameResults } from "../game/stats";
import { isDue, nextTimer, type Timer } from "../game/timers";
import { publicEvents, viewFor } from "../game/view";
import { PACKS, pairsOf } from "../game/words";
import { statsOf } from "../stats/LeaderboardDO";
import { realtime } from "../voice/realtime";
import {
  dropConn,
  markLost,
  members,
  nextSweep,
  prune,
  pullable,
  type Roster,
  sameRoster,
  sweep,
} from "../voice/roster";
import { PLAYER_HEADER } from "../web/api";
import {
  CLOSE_CODE,
  type CloseReason,
  parseMessage,
  type ServerMessage,
  type VoiceError,
  type VoiceOp,
  webLink,
} from "../web/protocol";
import { isWeb } from "./clients";
import { type Command, decide } from "./commands";

export const IDLE_MS = 6 * 60 * 60 * 1000;
const THEMES = PACKS.map((p) => p.id);

interface Stored {
  room: engine.Room;
  updatedAt: number;
  /** The reminder timer of the current phase, if one is on (src/game/timers.ts). */
  timer?: Timer | null;
}

/** Kept on each web socket; survives hibernation. */
interface SocketInfo {
  playerId: number;
  origin: string;
  /** Identifies this socket in the voice roster; absent on sockets opened before voice existed. */
  conn?: string;
}

export type JoinOutcome = "ok" | "not_found" | "already_in_room";

/** Which room each player is in, after a command: the GuestDO pointer behind one-room-per-player. */
function pointers(room: engine.Room, events: engine.GameEvent[]): [number, string | null][] {
  return events.flatMap((e): [number, string | null][] => {
    if (e.type === "joined" || e.type === "queued") return [[e.player.id, room.code]];
    if (e.type === "left") return [[e.player.id, null]];
    return [];
  });
}

/** One per room code. Owns the room state and pushes it to every player's web socket. */
export class GameRoomDO extends DurableObject<Env> {
  private load(): Stored | null {
    return this.ctx.storage.kv.get<Stored>("state") ?? null;
  }

  /**
   * The voice call, under its own key: it changes between awaited Realtime calls, apart
   * from the room state.
   */
  private loadVoice(): Roster {
    return this.ctx.storage.kv.get<Roster>("voice") ?? {};
  }

  private saveVoice(roster: Roster): void {
    if (Object.keys(roster).length) this.ctx.storage.kv.put("voice", roster);
    else this.ctx.storage.kv.delete("voice");
  }

  async create(code: string, host: engine.Player): Promise<boolean> {
    if (this.load()) return false;
    const stored: Stored = { room: engine.createRoom(code, host), updatedAt: Date.now() };
    this.ctx.storage.kv.put("state", stored);
    await this.schedule(stored);
    await this.point(host.id, code);
    return true;
  }

  private point(playerId: number, code: string | null): Promise<void> {
    return this.env.GUEST.getByName(String(playerId)).setRoom(code);
  }

  async join(player: engine.Player): Promise<JoinOutcome> {
    const stored = this.load();
    if (!stored) return "not_found";
    const result = engine.join(stored.room, player);
    if (!result.ok) return result.error === "already_in_room" ? "already_in_room" : "not_found";
    await this.commit(stored, result);
    return "ok";
  }

  /** Whether the room exists and has this player (playing or waiting). */
  has(playerId: number): boolean {
    const stored = this.load();
    return stored !== null && engine.inRoom(stored.room, playerId);
  }

  /** Returns false when the room no longer exists, so the caller can clear a stale pointer. */
  async leave(playerId: number): Promise<boolean> {
    const stored = this.load();
    if (!stored) return false;
    const result = engine.leave(stored.room, playerId);
    if (result.ok) await this.commit(stored, result);
    return true;
  }

  /** Runs one command; null on success. */
  private async apply(stored: Stored, playerId: number, cmd: Command): Promise<engine.GameError | null> {
    const result = decide(stored.room, playerId, cmd, {
      rng: cryptoRng,
      pairs: pairsOf,
      themes: THEMES,
      now: Date.now(),
    });
    if (!result.ok) return result.error;
    await this.commit(stored, result);
    return null;
  }

  /** A web player's WebSocket, forwarded by the Worker after it checked their session. */
  async fetch(request: Request): Promise<Response> {
    const playerId = Number(request.headers.get(PLAYER_HEADER));
    if (!Number.isSafeInteger(playerId) || !isWeb(playerId)) return new Response("Forbidden", { status: 403 });
    const stored = this.load();
    if (!stored) return new Response("Not found", { status: 404 });
    if (!engine.inRoom(stored.room, playerId)) return new Response("Forbidden", { status: 403 });

    // One socket per player: a new tab or a reconnect takes the seat over. The call seat waits
    // for this socket to resume it, and leaves the call after GRACE_MS otherwise.
    const tag = String(playerId);
    for (const old of this.ctx.getWebSockets(tag)) this.closeSocket(old, "replaced");
    await this.loseVoice(stored, { id: playerId });

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server, [tag]);
    const info: SocketInfo = { playerId, origin: new URL(request.url).origin, conn: crypto.randomUUID() };
    server.serializeAttachment(info);
    this.sendState(server, stored, info);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const info = ws.deserializeAttachment() as SocketInfo;
    const stored = this.load();
    if (!stored) return this.closeSocket(ws, "closed");
    const parsed = typeof message === "string" ? parseMessage(message) : null;
    if (!parsed) return this.sendTo(ws, { type: "error", code: "bad_request" });
    if (parsed.type === "voice") return this.onVoice(ws, info, parsed);
    const error = await this.apply(stored, info.playerId, parsed.cmd);
    if (error) {
      this.sendTo(ws, { type: "error", code: error });
      // Whatever the client showed was out of date; bring it back in line.
      const current = this.load();
      if (current) this.sendState(ws, current, info);
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    const { conn } = ws.deserializeAttachment() as SocketInfo;
    const stored = this.load();
    if (stored && conn) await this.loseVoice(stored, { conn });
    try {
      // Answer the close handshake. A browser that closed without a code reports 1005, which
      // may not be sent back: the reply would throw and leave the browser waiting ~10 s.
      ws.close(code === 1000 || (code >= 3000 && code <= 4999) ? code : 1000, reason);
    } catch {
      // Already closed.
    }
  }

  private sendTo(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // The socket is closing; the client gets the state on reconnect.
    }
  }

  private sendState(ws: WebSocket, stored: Stored, info: SocketInfo): void {
    const { room } = stored;
    this.sendTo(ws, {
      type: "state",
      view: viewFor(room, info.playerId, stored.timer ?? null),
      links: { web: webLink(info.origin, room.code) },
    });
    this.sendTo(ws, this.voiceMessage(stored, this.loadVoice()));
  }

  /** A seat whose socket went away stays in the call for GRACE_MS, shown as reconnecting. */
  private async loseVoice(stored: Stored, lost: { conn: string } | { id: number }): Promise<void> {
    const roster = this.loadVoice();
    const next = markLost(roster, lost, Date.now());
    if (sameRoster(roster, next)) return;
    this.saveVoice(next);
    this.pushVoice(stored, next);
    await this.schedule(stored);
  }

  private voiceMessage(stored: Stored, roster: Roster): ServerMessage {
    return { type: "voice", on: stored.room.settings.voice, members: members(stored.room, roster) };
  }

  /** Tells every connected web player who is in the call. */
  private pushVoice(stored: Stored, roster: Roster): void {
    const message = this.voiceMessage(stored, roster);
    for (const ws of this.ctx.getWebSockets()) {
      const info = ws.deserializeAttachment() as SocketInfo;
      if (engine.inRoom(stored.room, info.playerId)) this.sendTo(ws, message);
    }
  }

  /**
   * Voice signaling. Calls to the Realtime API are awaited, and other messages can run
   * meanwhile, so the roster is read again before every write. Voice never touches the game.
   */
  private async onVoice(ws: WebSocket, info: SocketInfo, op: VoiceOp): Promise<void> {
    const fail = (code: VoiceError) => this.sendTo(ws, { type: "voiceError", code });
    const me = info.playerId;
    const stored = this.load();
    if (!stored) return this.closeSocket(ws, "closed");
    if (!stored.room.settings.voice) return fail("voice_off");
    const seat = this.loadVoice()[me];
    const mine = seat !== undefined && info.conn !== undefined && seat.conn === info.conn;

    if (op.op === "resume") {
      const roster = this.loadVoice();
      const own = roster[me];
      if (!own || own.track !== op.key || !info.conn) return fail("not_in_call");
      const { lostAt: _, ...back } = own;
      const next = { ...roster, [me]: { ...back, conn: info.conn } };
      this.saveVoice(next);
      return this.pushVoice(stored, next);
    }

    if (op.op === "leave" || op.op === "mute") {
      if (!mine) return fail("not_in_call");
      const roster = this.loadVoice();
      const next =
        op.op === "leave"
          ? dropConn(roster, seat.conn)
          : { ...roster, [me]: { ...(roster[me] ?? seat), muted: op.muted } };
      this.saveVoice(next);
      return this.pushVoice(stored, next);
    }

    const rt = realtime(this.env);
    if (!rt || !info.conn) return fail("unavailable");
    try {
      if (op.op === "join") {
        const sessionId = await rt.newSession();
        const track = `p${Math.abs(me)}-${crypto.randomUUID().slice(0, 8)}`;
        const answer = await rt.push(sessionId, { type: "offer", sdp: op.sdp }, op.mid, track);
        const now = this.load();
        if (!now?.room.settings.voice || !engine.inRoom(now.room, me)) return fail("voice_off");
        const next = { ...this.loadVoice(), [me]: { sessionId, track, muted: false, conn: info.conn } };
        this.saveVoice(next);
        this.sendTo(ws, { type: "voiceSdp", sdp: answer, tracks: [] });
        return this.pushVoice(now, next);
      }
      if (!mine) return fail("not_in_call");
      if (op.op === "answer") return await rt.renegotiate(seat.sessionId, { type: "answer", sdp: op.sdp });
      // pull
      const wanted = pullable(prune(stored.room, this.loadVoice()), me, op.ids);
      if (!wanted.length) return this.sendTo(ws, { type: "voiceSdp", sdp: null, tracks: [] });
      const { offer, mids } = await rt.pull(
        seat.sessionId,
        wanted.map((w) => ({ sessionId: w.seat.sessionId, trackName: w.seat.track })),
      );
      const tracks = wanted.flatMap((w) => {
        const mid = mids[w.seat.track];
        return mid ? [{ id: w.id, key: w.seat.track, mid }] : [];
      });
      this.sendTo(ws, { type: "voiceSdp", sdp: offer, tracks });
    } catch (err) {
      console.warn("voice failed", { room: stored.room.code, op: op.op, error: String(err) });
      fail("unavailable");
    }
  }

  private closeSocket(ws: WebSocket, reason: CloseReason): void {
    this.sendTo(ws, { type: "closed", reason });
    try {
      ws.close(CLOSE_CODE[reason], reason);
    } catch {
      // Already closed.
    }
  }

  /** Sends every connected web player the events (secrets removed) and their new view. */
  private pushWeb(stored: Stored | null, events: engine.GameEvent[]): void {
    const pub = publicEvents(events);
    for (const ws of this.ctx.getWebSockets()) {
      const info = ws.deserializeAttachment() as SocketInfo;
      if (!stored) {
        this.closeSocket(ws, "closed");
        continue;
      }
      if (!engine.inRoom(stored.room, info.playerId)) {
        this.closeSocket(ws, "left");
        continue;
      }
      if (pub.length) this.sendTo(ws, { type: "events", events: pub });
      this.sendState(ws, stored, info);
    }
  }

  /** One alarm per room: the earliest of the reminder timer, a lost voice seat to sweep, and the idle close. */
  private async schedule(stored: Stored): Promise<void> {
    const idle = stored.updatedAt + IDLE_MS;
    const timer = stored.timer && !stored.timer.fired ? stored.timer.endsAt : Number.POSITIVE_INFINITY;
    const voice = nextSweep(this.loadVoice()) ?? Number.POSITIVE_INFINITY;
    await this.ctx.storage.setAlarm(Math.min(idle, timer, voice));
  }

  /** Sends a due reminder, or closes the room after IDLE_MS without activity. */
  async alarm(): Promise<void> {
    const stored = this.load();
    if (!stored) return;
    const now = Date.now();
    const roster = this.loadVoice();
    const swept = sweep(roster, now);
    if (!sameRoster(roster, swept)) {
      this.saveVoice(swept);
      this.pushVoice(stored, swept);
    }
    if (isDue(stored.room, stored.timer ?? null, now)) {
      const timer = stored.timer as Timer;
      const next: Stored = { ...stored, timer: { ...timer, fired: true } };
      this.ctx.storage.kv.put("state", next);
      await this.schedule(next);
      // The web shows "time is up" from the view; the host still opens or closes the vote.
      this.pushWeb(next, []);
      return;
    }
    if (now - stored.updatedAt < IDLE_MS) {
      await this.schedule(stored);
      return;
    }
    const everyone = [...stored.room.players, ...stored.room.waiting].map((p) => p.id);
    await Promise.all(everyone.map((id) => this.point(id, null)));
    this.ctx.storage.kv.delete("state");
    this.saveVoice({});
    this.pushWeb(null, []);
  }

  private async commit(stored: Stored, result: Extract<engine.Result, { ok: true }>): Promise<void> {
    const closed = result.events.some((e) => e.type === "closed");
    const now = Date.now();
    const next: Stored = {
      ...stored,
      room: result.room,
      updatedAt: now,
      timer: nextTimer(result.room, stored.timer ?? null, now),
    };

    // Persist before pushing, so a failure afterwards cannot replay the command.
    // Players who left, or a host turning voice off, take seats out of the call.
    const roster = this.loadVoice();
    const kept = closed ? {} : prune(result.room, roster);
    if (!sameRoster(roster, kept)) this.saveVoice(kept);
    if (closed) {
      this.ctx.storage.kv.delete("state");
      await this.ctx.storage.deleteAlarm();
    } else {
      this.ctx.storage.kv.put("state", next);
      await this.schedule(next);
    }

    this.pushWeb(closed ? null : next, result.events);
    await Promise.all(pointers(result.room, result.events).map(([id, code]) => this.point(id, code)));

    const ended = result.events.find((e) => e.type === "game_ended");
    if (ended?.type === "game_ended") await this.recordStats(ended.game);
  }

  /** Long-term stats are a bonus: a failed write must never break the game. */
  private async recordStats(game: engine.Game): Promise<void> {
    const results = gameResults(game);
    if (!results.length) return;
    try {
      await statsOf(this.env).record(results);
    } catch (err) {
      console.warn("stats write failed", { room: this.load()?.room.code, error: String(err) });
    }
  }
}
