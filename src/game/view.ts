import {
  effectiveCounts,
  type GameEvent,
  handOf,
  type Phase,
  playerName,
  type Room,
  type Side,
  settingsProblem,
} from "./engine";
import type { CountsProblem, Role } from "./roles";
import { phaseKey, type Timer } from "./timers";
import { PACKS } from "./words";

/**
 * What one player may see of a room. Pure. Every client that is not Telegram
 * receives only this, so secrecy is decided here and nowhere else:
 * - a player's own word (never their role: a spy must not learn they are a spy);
 * - another player's role only once they are out, or when the game has ended;
 * - both words only when the game has ended;
 * - vote counts, never who voted for whom (except the viewer's own vote).
 */

export interface ViewPlayer {
  id: number;
  name: string;
}

export interface MyHand {
  /** null: the viewer is Mr. White. */
  word: string | null;
}

export interface GameView {
  id: number;
  round: number;
  phase: Phase;
  /** Speaking order of living players for this round. */
  order: number[];
  alive: number[];
  /** Everyone dealt into this game, including players who since left. */
  dealt: ViewPlayer[];
  /** null when the viewer is not dealt into this game (waiting list). */
  hand: MyHand | null;
  /** Players the viewer may vote for right now; empty when they cannot vote. */
  canVoteFor: number[];
  myVote: number | null;
  votes: { count: number; total: number };
  revote: boolean;
  /** Roles that are public: eliminated players, or everyone once the game ended. */
  roles: Record<number, Role>;
  /** Who is guessing, during Mr. White's guess. */
  guesser: number | null;
  /** Only once the game has ended. */
  words: { civilian: string; spy: string } | null;
  winner: Side | null;
  /** The reminder timer of the current phase; endsAt in epoch ms, possibly in the past. */
  timer: { kind: Timer["kind"]; endsAt: number } | null;
}

export interface SettingsView {
  /** True while role counts follow the role table. */
  auto: boolean;
  /** Counts the next game will use; null below 3 players while auto. */
  spies: number | null;
  white: number | null;
  themes: { id: string; name: string; on: boolean }[];
  /** Why Start would be refused right now, or null. */
  problem: CountsProblem | null;
  /** Reminder timers in minutes; 0 is off. */
  timers: { discussion: number; vote: number };
}

export interface RoomView {
  code: string;
  me: number;
  hostId: number;
  players: ViewPlayer[];
  waiting: ViewPlayer[];
  game: GameView | null;
  scores: { id: number; name: string; wins: number }[];
  settings: SettingsView;
}

export function viewFor(room: Room, viewer: number, timer: Timer | null = null): RoomView {
  return {
    code: room.code,
    me: viewer,
    hostId: room.hostId,
    players: room.players.map(({ id, name }) => ({ id, name })),
    waiting: room.waiting.map(({ id, name }) => ({ id, name })),
    game: gameView(room, viewer, timer),
    scores: Object.entries(room.scores)
      .map(([id, wins]) => ({ id: Number(id), name: playerName(room, Number(id)), wins }))
      .sort((a, b) => b.wins - a.wins),
    settings: settingsView(room),
  };
}

export function settingsView(room: Room): SettingsView {
  const counts = effectiveCounts(room);
  const { themes } = room.settings;
  return {
    auto: room.settings.counts === null,
    spies: counts?.spies ?? null,
    white: counts?.white ?? null,
    themes: PACKS.map((p) => ({ id: p.id, name: p.name, on: themes.length === 0 || themes.includes(p.id) })),
    problem: settingsProblem(room),
    timers: { ...room.settings.timers },
  };
}

function gameView(room: Room, viewer: number, timer: Timer | null): GameView | null {
  const game = room.game;
  if (!game) return null;
  const ended = game.phase === "ended";
  const own = handOf(game, viewer);
  const roles: Record<number, Role> = {};
  for (const h of game.hands) if (ended || !game.alive.includes(h.playerId)) roles[h.playerId] = h.role;
  const canVote = game.phase === "voting" && game.alive.includes(viewer);
  const guesser =
    game.phase === "white_guess"
      ? (game.hands.find((h) => h.role === "white" && !game.alive.includes(h.playerId))?.playerId ?? null)
      : null;

  return {
    id: game.id,
    round: game.round,
    phase: game.phase,
    order: [...game.order],
    alive: [...game.alive],
    dealt: game.hands.map((h) => ({ id: h.playerId, name: playerName(room, h.playerId) })),
    hand: own ? { word: own.word } : null,
    canVoteFor: canVote ? game.candidates.filter((id) => id !== viewer) : [],
    myVote: game.phase === "voting" ? (game.votes[viewer] ?? null) : null,
    votes: { count: game.phase === "voting" ? Object.keys(game.votes).length : 0, total: game.alive.length },
    revote: game.revote,
    roles,
    guesser,
    words: ended ? { civilian: game.civilianWord, spy: game.spyWord } : null,
    winner: game.winner,
    timer: timer && phaseKey(room)?.key === timer.key ? { kind: timer.kind, endsAt: timer.endsAt } : null,
  };
}

/** Events as any player may see them: the dealt game and individual ballots are dropped. */
export type PublicEvent =
  | Exclude<GameEvent, { type: "game_started" | "vote_cast" | "game_ended" }>
  | { type: "game_started"; gameId: number; players: number; spies: number; white: number }
  | { type: "vote_cast"; count: number; total: number }
  | { type: "game_ended"; winner: Side | null };

export function publicEvents(events: readonly GameEvent[]): PublicEvent[] {
  return events.map((e): PublicEvent => {
    switch (e.type) {
      case "game_started":
        return {
          type: "game_started",
          gameId: e.game.id,
          players: e.game.hands.length,
          spies: e.game.hands.filter((h) => h.role === "spy").length,
          white: e.game.hands.filter((h) => h.role === "white").length,
        };
      case "vote_cast":
        return { type: "vote_cast", count: e.count, total: e.total };
      case "game_ended":
        return { type: "game_ended", winner: e.winner };
      default:
        return e;
    }
  });
}
