import { DurableObject } from "cloudflare:workers";
import { Api } from "grammy";
import { type Callback, decodeChange, THEMES_CLOSE, THEMES_OPEN } from "../bot/callbacks";
import { msg } from "../bot/messages";
import {
  inviteLink,
  lobbyPanel,
  type Op,
  plan,
  type RoomLinks,
  type Slot,
  scoreboard,
  themesClosed,
  themesPanel,
  timerReminder,
  webLink,
  wordAlert,
} from "../bot/render";
import { editOrSend, send } from "../bot/telegram";
import type { Env } from "../env";
import * as engine from "../game/engine";
import { cryptoRng } from "../game/rng";
import { gameResults } from "../game/stats";
import { isDue, nextTimer, type Timer } from "../game/timers";
import { publicEvents, viewFor } from "../game/view";
import { PACKS, pairsOf } from "../game/words";
import { statsOf } from "../stats/StatsDO";
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
} from "../web/protocol";
import { isWeb } from "./clients";
import { type Command, decide } from "./commands";

export const IDLE_MS = 6 * 60 * 60 * 1000;
const THEMES = PACKS.map((p) => p.id);

interface Stored {
  room: engine.Room;
  botUsername: string;
  /** Origin of the web app; absent in rooms stored before the web app existed. */
  webOrigin?: string;
  /** Message ids we edit in place, per slot and player. */
  ui: Record<Slot, Record<number, number>>;
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

const errorText: Record<engine.GameError, string> = {
  already_in_room: msg.alreadyInThisRoom(""),
  not_in_room: msg.notInRoom,
  not_host: msg.notHost,
  too_few_players: msg.tooFewPlayers,
  game_running: msg.gameRunning,
  no_game: msg.stale,
  wrong_phase: msg.stale,
  stale: msg.stale,
  not_alive: msg.notAlive,
  invalid_target: msg.invalidTarget,
  not_white: msg.stale,
  bad_counts: msg.badCounts,
  bad_setting: msg.badSetting,
};

const linksOf = (stored: Stored): RoomLinks => ({
  botUsername: stored.botUsername,
  webOrigin: stored.webOrigin ?? null,
});

/** null for "word", which only reads state and is answered with a popup. */
function toCommand(cb: Callback): Command | null {
  const turn = { gameId: cb.gameId, round: cb.round };
  switch (cb.action) {
    case "start":
    case "leave":
      return { action: cb.action };
    case "again":
    case "openVote":
    case "closeVote":
      return { action: cb.action, ...turn };
    case "end":
      return { action: "end", gameId: cb.gameId };
    case "vote":
      return { action: "vote", ...turn, target: cb.arg };
    case "configure": {
      const change = decodeChange(cb.arg);
      return change ? { action: "configure", change } : null;
    }
    case "word":
      return null;
  }
}

/** One per room code. Owns the room state and every message the room sends. */
export class RoomDO extends DurableObject<Env> {
  private load(): Stored | null {
    const stored = this.ctx.storage.kv.get<Stored>("state") ?? null;
    // Rooms stored before the theme picker existed.
    if (stored && !stored.ui.themes) stored.ui = { ...stored.ui, themes: {} };
    // Rooms stored before host settings, timers or voice existed.
    if (stored && (!stored.room.settings?.timers || stored.room.settings.voice === undefined))
      stored.room = { ...stored.room, settings: { ...engine.DEFAULT_SETTINGS, ...stored.room.settings } };
    return stored;
  }

  /**
   * The voice call, under its own key: execute() writes back a Stored it loaded before
   * awaiting Telegram, and must not undo a join or mute that happened meanwhile.
   */
  private loadVoice(): Roster {
    return this.ctx.storage.kv.get<Roster>("voice") ?? {};
  }

  private saveVoice(roster: Roster): void {
    if (Object.keys(roster).length) this.ctx.storage.kv.put("voice", roster);
    else this.ctx.storage.kv.delete("voice");
  }

  private api(): Api {
    return new Api(this.env.TELEGRAM_BOT_TOKEN);
  }

  async create(code: string, host: engine.Player, links: RoomLinks): Promise<boolean> {
    if (this.load()) return false;
    const room = engine.createRoom(code, host);
    const stored: Stored = {
      room,
      botUsername: links.botUsername,
      ...(links.webOrigin ? { webOrigin: links.webOrigin } : {}),
      ui: { lobby: {}, vote: {}, status: {}, themes: {} },
      updatedAt: Date.now(),
    };
    await this.execute(stored, [
      { kind: "pointer", to: host.id, code: room.code },
      { kind: "send", to: host.id, slot: "lobby", ...lobbyPanel(room, host.id, links) },
    ]);
    return true;
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

  async onCallback(userId: number, cb: Callback): Promise<{ text: string; alert?: boolean }> {
    const stored = this.load();
    if (!stored) return { text: msg.stale };

    if (cb.action === "word") {
      const game = stored.room.game;
      if (!game || game.id !== cb.gameId) return { text: msg.stale };
      return { text: wordAlert(game, userId), alert: true };
    }

    if (cb.action === "configure" && (cb.arg === THEMES_OPEN || cb.arg === THEMES_CLOSE)) {
      const { room } = stored;
      if (userId !== room.hostId) return { text: msg.notHost };
      if (engine.isRunning(room)) return { text: msg.gameRunning };
      await this.execute(stored, [
        cb.arg === THEMES_OPEN
          ? { kind: "send", to: userId, slot: "themes", ...themesPanel(room) }
          : { kind: "edit", to: userId, slot: "themes", ifShown: true, text: themesClosed(room) },
      ]);
      return { text: "👌" };
    }

    const cmd = toCommand(cb);
    if (!cmd) return { text: msg.stale };
    const error = await this.apply(stored, userId, cmd);
    if (error) return { text: errorText[error] };
    return { text: cb.action === "vote" ? msg.voted(engine.playerName(stored.room, cb.arg)) : "👌" };
  }

  /** Free text from a player in this room; only Mr. White's guess means anything. */
  async onText(userId: number, text: string): Promise<boolean> {
    const stored = this.load();
    if (!stored) return false;
    return (await this.apply(stored, userId, { action: "guess", text })) === null;
  }

  async end(userId: number): Promise<string | null> {
    const stored = this.load();
    if (!stored) return msg.notInRoom;
    const error = await this.apply(stored, userId, { action: "end" });
    return error ? errorText[error] : null;
  }

  /** Runs one command from any client; null on success. */
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
    if (!Number.isSafeInteger(playerId) || playerId >= 0) return new Response("Forbidden", { status: 403 });
    const stored = this.load();
    if (!stored) return new Response("Not found", { status: 404 });
    if (!engine.inRoom(stored.room, playerId)) return new Response("Forbidden", { status: 403 });

    // One socket per player: a new tab or a reconnect takes the seat over. The call seat waits
    // for this socket to resume it, and leaves the call after GRACE_MS otherwise.
    for (const old of this.ctx.getWebSockets(String(playerId))) this.closeSocket(old, "replaced");
    await this.loseVoice(stored, { id: playerId });

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server, [String(playerId)]);
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
      links: { web: webLink(info.origin, room.code), telegram: inviteLink(stored.botUsername, room.code) },
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

  score(): string {
    const stored = this.load();
    return stored ? scoreboard(stored.room) : msg.notInRoom;
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
      this.pushWeb(next, []);
      await this.execute(next, timerReminder(next.room, timer.kind));
      return;
    }
    if (now - stored.updatedAt < IDLE_MS) {
      await this.schedule(stored);
      return;
    }
    const everyone = [...stored.room.players, ...stored.room.waiting].map((p) => p.id);
    await this.execute(
      stored,
      everyone.flatMap((id): Op[] => [
        { kind: "pointer", to: id, code: null },
        { kind: "send", to: id, text: msg.roomIdleClosed(stored.room.code) },
      ]),
    );
    this.ctx.storage.kv.delete("state");
    this.saveVoice({});
    this.pushWeb(null, []);
  }

  private async commit(stored: Stored, result: Extract<engine.Result, { ok: true }>): Promise<void> {
    const before = stored.room;
    const closed = result.events.some((e) => e.type === "closed");
    const now = Date.now();
    const next: Stored = {
      ...stored,
      room: result.room,
      updatedAt: now,
      timer: nextTimer(result.room, stored.timer ?? null, now),
    };

    // Persist before talking to Telegram, so a failure mid-broadcast cannot replay the command.
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

    // Web players first: their sockets are local and fast; Telegram calls can take a while.
    this.pushWeb(closed ? null : next, result.events);

    const ended = result.events.find((e) => e.type === "game_ended");
    if (ended?.type === "game_ended") await this.recordStats(ended.game);

    await this.execute(next, plan(before, result.room, result.events, linksOf(stored)));
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

  /** Runs ops in order per chat, chats in parallel. Records message ids into stored.ui. */
  private async execute(stored: Stored, ops: Op[]): Promise<void> {
    const api = this.api();
    const byChat = new Map<number, Op[]>();
    for (const op of ops) {
      // Web players have no Telegram chat; they only need their room pointer.
      if (isWeb(op.to) && op.kind !== "pointer") continue;
      byChat.set(op.to, [...(byChat.get(op.to) ?? []), op]);
    }

    await Promise.all(
      [...byChat.entries()].map(async ([chat, chatOps]) => {
        for (const op of chatOps) {
          if (op.kind === "pointer") {
            await this.env.PLAYER.getByName(String(chat)).setRoom(op.code);
          } else if (op.kind === "send") {
            const id = await send(api, chat, op.text, op.keyboard);
            if (op.slot && id !== null) stored.ui[op.slot][chat] = id;
          } else {
            const shown = stored.ui[op.slot][chat];
            if (op.ifShown && shown === undefined) continue;
            const id = await editOrSend(api, chat, shown, op.text, op.keyboard);
            if (id !== null) stored.ui[op.slot][chat] = id;
          }
        }
      }),
    );
    // Save the message ids unless the room was closed while we were sending.
    if (this.load() !== null || ops.some((o) => o.kind === "send" && o.slot)) this.ctx.storage.kv.put("state", stored);
  }
}
