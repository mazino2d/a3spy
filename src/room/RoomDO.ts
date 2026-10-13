import { DurableObject } from "cloudflare:workers";
import { Api } from "grammy";
import type { Callback } from "../bot/callbacks";
import { msg } from "../bot/messages";
import { lobbyPanel, type Op, plan, type Slot, scoreboard, wordAlert } from "../bot/render";
import { editOrSend, send } from "../bot/telegram";
import type { Env } from "../env";
import * as engine from "../game/engine";
import { cryptoRng } from "../game/rng";
import { pairsOf } from "../game/words";
import { isWeb } from "./clients";
import { type Command, decide } from "./commands";

export const IDLE_MS = 6 * 60 * 60 * 1000;

interface Stored {
  room: engine.Room;
  botUsername: string;
  /** Message ids we edit in place, per slot and player. */
  ui: Record<Slot, Record<number, number>>;
  updatedAt: number;
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
};

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
    case "word":
      return null;
  }
}

/** One per room code. Owns the room state and every message the room sends. */
export class RoomDO extends DurableObject<Env> {
  private load(): Stored | null {
    return this.ctx.storage.kv.get<Stored>("state") ?? null;
  }

  private api(): Api {
    return new Api(this.env.TELEGRAM_BOT_TOKEN);
  }

  async create(code: string, host: engine.Player, botUsername: string): Promise<boolean> {
    if (this.load()) return false;
    const room = engine.createRoom(code, host);
    const stored: Stored = { room, botUsername, ui: { lobby: {}, vote: {}, status: {} }, updatedAt: Date.now() };
    await this.execute(stored, [
      { kind: "pointer", to: host.id, code: room.code },
      { kind: "send", to: host.id, slot: "lobby", ...lobbyPanel(room, host.id, botUsername) },
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
    const result = decide(stored.room, playerId, cmd, { rng: cryptoRng, pairs: pairsOf(), now: Date.now() });
    if (!result.ok) return result.error;
    await this.commit(stored, result);
    return null;
  }

  score(): string {
    const stored = this.load();
    return stored ? scoreboard(stored.room) : msg.notInRoom;
  }

  /** Closes the room after IDLE_MS without activity. */
  async alarm(): Promise<void> {
    const stored = this.load();
    if (!stored) return;
    if (Date.now() - stored.updatedAt < IDLE_MS) {
      await this.ctx.storage.setAlarm(stored.updatedAt + IDLE_MS);
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
  }

  private async commit(stored: Stored, result: Extract<engine.Result, { ok: true }>): Promise<void> {
    const before = stored.room;
    const closed = result.events.some((e) => e.type === "closed");
    const next: Stored = { ...stored, room: result.room, updatedAt: Date.now() };

    // Persist before talking to Telegram, so a failure mid-broadcast cannot replay the command.
    if (closed) {
      this.ctx.storage.kv.delete("state");
      await this.ctx.storage.deleteAlarm();
    } else {
      this.ctx.storage.kv.put("state", next);
      await this.ctx.storage.setAlarm(next.updatedAt + IDLE_MS);
    }

    await this.execute(next, plan(before, result.room, result.events, stored.botUsername));
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
            const id = await editOrSend(api, chat, stored.ui[op.slot][chat], op.text, op.keyboard);
            if (id !== null) stored.ui[op.slot][chat] = id;
          }
        }
      }),
    );
    // Save the message ids unless the room was closed while we were sending.
    if (this.load() !== null || ops.some((o) => o.kind === "send" && o.slot)) this.ctx.storage.kv.put("state", stored);
  }
}
