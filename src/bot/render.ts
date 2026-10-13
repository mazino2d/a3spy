import { type Game, type GameEvent, handOf, isRunning, playerName, type Room } from "../game/engine";
import type { Hand } from "../game/roles";
import { type Action, encode } from "./callbacks";
import { msg } from "./messages";

/**
 * Turns a room and the events a command produced into Telegram operations.
 * Pure: the Durable Object executes the plan and remembers message ids.
 */

export interface Button {
  text: string;
  data: string;
}
export type Keyboard = Button[][];

export type Slot = "lobby" | "vote" | "status";

export type Op =
  | { kind: "send"; to: number; text: string; keyboard?: Keyboard; slot?: Slot }
  | { kind: "edit"; to: number; slot: Slot; text: string; keyboard?: Keyboard }
  | { kind: "pointer"; to: number; code: string | null };

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const name = (room: Room, id: number) => esc(playerName(room, id));

function button(room: Room, text: string, action: Action, arg = 0): Button {
  return {
    text,
    data: encode({ action, code: room.code, gameId: room.game?.id ?? 0, round: room.game?.round ?? 0, arg }),
  };
}

export const inviteLink = (botUsername: string, code: string) => `https://t.me/${botUsername}?start=${code}`;
export const webLink = (origin: string, code: string) => `${origin}/r/${code}`;

/** Where a room can be joined from: Telegram, and the web app when its origin is known. */
export interface RoomLinks {
  botUsername: string;
  webOrigin: string | null;
}

export function lobbyPanel(room: Room, viewer: number, links: RoomLinks): { text: string; keyboard: Keyboard } {
  const isHost = viewer === room.hostId;
  const players = room.players.map((p) => esc(p.name) + (p.id === room.hostId ? " 👑" : ""));
  const keyboard: Keyboard = isHost
    ? [[button(room, msg.btnStart, "start")], [button(room, msg.btnLeave, "leave")]]
    : [[button(room, msg.btnLeave, "leave")]];
  return {
    text: msg.lobby(
      room.code,
      name(room, room.hostId),
      players,
      inviteLink(links.botUsername, room.code),
      links.webOrigin ? webLink(links.webOrigin, room.code) : null,
      isHost,
    ),
    keyboard,
  };
}

export function dealMessage(room: Room, hand: Hand): { text: string; keyboard: Keyboard } {
  return {
    text: hand.word === null ? msg.youAreWhite : msg.yourWord(esc(hand.word)),
    keyboard: [[button(room, msg.btnWord, "word")]],
  };
}

function votePanel(room: Room, game: Game, voter: number, chosen?: number): { text: string; keyboard: Keyboard } {
  const options = game.candidates.filter((id) => id !== voter);
  const rows = options.map((id) => [button(room, `${id === chosen ? "✅ " : ""}${playerName(room, id)}`, "vote", id)]);
  const header = msg.votePrompt(game.round, game.revote);
  return { text: chosen === undefined ? header : `${header}\n\n${msg.voteChosen(name(room, chosen))}`, keyboard: rows };
}

function hostKeyboard(room: Room): Keyboard | undefined {
  const game = room.game;
  if (!game) return undefined;
  if (game.phase === "describing")
    return [[button(room, msg.btnOpenVote, "openVote")], [button(room, msg.btnEnd, "end")]];
  if (game.phase === "ended") return [[button(room, msg.btnAgain, "again")]];
  return undefined;
}

function revealLines(room: Room, game: Game): string[] {
  return game.hands.map((h) => msg.revealLine(name(room, h.playerId), h.role, game.alive.includes(h.playerId)));
}

export function scoreboard(room: Room): string {
  const ranked = Object.entries(room.scores)
    .map(([id, wins]) => ({ id: Number(id), wins }))
    .sort((a, b) => b.wins - a.wins);
  return msg.score(ranked.map((r, i) => msg.scoreLine(i + 1, name(room, r.id), r.wins)));
}

export function wordAlert(game: Game, viewer: number): string {
  const hand = handOf(game, viewer);
  return hand ? msg.yourWordAlert(hand.word) : msg.notPlaying;
}

/**
 * @param before room before the command (to reach players who just left)
 * @param after room after the command
 */
export function plan(before: Room, after: Room, events: GameEvent[], links: RoomLinks): Op[] {
  const ops: Op[] = [];
  const lines: string[] = [];
  let refreshLobby = false;
  const fresh = new Set<number>();
  const game = after.game;

  for (const e of events) {
    switch (e.type) {
      case "joined": {
        const panel = lobbyPanel(after, e.player.id, links);
        ops.push({ kind: "pointer", to: e.player.id, code: after.code });
        ops.push({ kind: "send", to: e.player.id, slot: "lobby", ...panel });
        fresh.add(e.player.id);
        refreshLobby = true;
        break;
      }
      case "queued":
        ops.push({ kind: "pointer", to: e.player.id, code: after.code });
        ops.push({ kind: "send", to: e.player.id, text: msg.queued });
        lines.push(msg.queuedNotice(esc(e.player.name)));
        break;
      case "left":
        ops.push({ kind: "pointer", to: e.player.id, code: null });
        ops.push({ kind: "send", to: e.player.id, text: msg.youLeft(after.code) });
        if (isRunning(before)) lines.push(msg.leftNotice(esc(e.player.name)));
        else refreshLobby = true;
        break;
      case "host_changed":
        if (isRunning(after)) lines.push(msg.hostChanged(name(after, e.hostId)));
        refreshLobby = true;
        break;
      case "closed":
        break;
      case "game_started": {
        const spies = e.game.hands.filter((h) => h.role === "spy").length;
        const white = e.game.hands.filter((h) => h.role === "white").length;
        for (const hand of e.game.hands) ops.push({ kind: "send", to: hand.playerId, ...dealMessage(after, hand) });
        lines.push(msg.gameStarted(e.game.id, e.game.hands.length, spies, white));
        break;
      }
      case "round_started":
        lines.push(
          msg.round(
            e.round,
            e.order.map((id) => name(after, id)),
          ),
        );
        break;
      case "vote_opened":
        if (game) {
          for (const voter of e.voters)
            ops.push({ kind: "send", to: voter, slot: "vote", ...votePanel(after, game, voter) });
          ops.push({
            kind: "send",
            to: after.hostId,
            slot: "status",
            text: msg.voteStatus(0, e.voters.length),
            keyboard: [[button(after, msg.btnCloseVote, "closeVote")]],
          });
        }
        break;
      case "vote_cast":
        if (game?.phase === "voting") {
          ops.push({ kind: "edit", to: e.voterId, slot: "vote", ...votePanel(after, game, e.voterId, e.targetId) });
          ops.push({
            kind: "edit",
            to: after.hostId,
            slot: "status",
            text: msg.voteStatus(e.count, e.total),
            keyboard: [[button(after, msg.btnCloseVote, "closeVote")]],
          });
        }
        break;
      case "vote_closed": {
        const tally = Object.entries(e.tally)
          .sort(([, a], [, b]) => b - a)
          .map(([id, n]) => msg.tallyLine(name(after, Number(id)), n));
        lines.push(tally.length ? msg.tally(tally) : msg.noVotes);
        break;
      }
      case "tie":
        lines.push(msg.tie(e.tied.map((id) => name(after, id))));
        break;
      case "no_elimination":
        lines.push(e.reason === "tie" ? msg.noEliminationTie : msg.noEliminationNoVotes);
        break;
      case "eliminated":
        lines.push(msg.eliminated(name(after, e.playerId), e.role));
        break;
      case "white_guessing":
        lines.push(msg.whiteGuessing(name(after, e.playerId)));
        ops.push({ kind: "send", to: e.playerId, text: msg.whitePrompt });
        break;
      case "white_guessed":
        lines.push(msg.whiteGuessed(name(after, e.playerId), esc(e.guess), e.correct));
        break;
      case "game_ended":
        lines.push(e.winner ? msg.winner[e.winner] : msg.endedEarly);
        lines.push(msg.reveal(esc(e.game.civilianWord), esc(e.game.spyWord), revealLines(after, e.game)));
        lines.push(scoreboard(after));
        break;
    }
  }

  if (refreshLobby && !isRunning(after)) {
    for (const p of after.players) {
      if (fresh.has(p.id)) continue;
      ops.push({ kind: "edit", to: p.id, slot: "lobby", ...lobbyPanel(after, p.id, links) });
    }
  }

  if (lines.length) {
    const recipients = [...after.players, ...after.waiting].map((p) => p.id);
    const phase = game?.phase;
    for (const id of recipients) {
      const isHost = id === after.hostId;
      const hint =
        isHost && phase === "describing" ? msg.hostRoundHint : isHost && phase === "ended" ? msg.hostAgainHint : null;
      const text = [...lines, ...(hint ? [hint] : [])].join("\n\n");
      const keyboard = isHost ? hostKeyboard(after) : undefined;
      ops.push(keyboard ? { kind: "send", to: id, text, keyboard } : { kind: "send", to: id, text });
    }
  }

  return ops;
}
