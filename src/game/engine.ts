import { type Rng, shuffle } from "./rng";
import {
  type CountsProblem,
  checkRoleCounts,
  deal,
  defaultRoleCounts,
  type Hand,
  MIN_PLAYERS,
  type Role,
  type RoleCounts,
  type WordPair,
} from "./roles";

/**
 * Room and game state machine. Pure: every command takes the current room
 * and returns the next room plus the events that happened, or an error.
 * The Durable Object persists the room; the bot layer renders the events.
 */

export const REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface Player {
  id: number;
  name: string;
}

export type Phase = "describing" | "voting" | "white_guess" | "ended";
export type Side = "civilians" | "spies" | "white";

export interface Game {
  /** Increments per game in the room; stale buttons carry it. */
  id: number;
  round: number;
  phase: Phase;
  hands: Hand[];
  alive: number[];
  /** Speaking order for the current round. */
  order: number[];
  /** voterId → targetId for the open vote. */
  votes: Record<number, number>;
  /** Players who may receive votes; everyone alive unless this is a revote. */
  candidates: number[];
  revote: boolean;
  civilianWord: string;
  spyWord: string;
  winner: Side | null;
  /** Names at deal time, so the reveal still names players who left. */
  names: Record<number, string>;
}

/** Host settings, kept for every game in the room until changed (docs/rules.md#host-settings). */
export interface Settings {
  /** Word themes (pack ids) to draw from; empty means every theme. */
  themes: string[];
  /** Role counts chosen by the host; null follows the role table for the player count. */
  counts: RoleCounts | null;
  /** Reminder timers in minutes; 0 is off (docs/rules.md#timers). */
  timers: { discussion: number; vote: number };
  /** "Chơi online": the room has a voice call (docs/rules.md#voice); on by default (M8). */
  voice: boolean;
}

export const TIMER_OPTIONS = { discussion: [0, 2, 3, 5], vote: [0, 1, 2] } as const;

export const DEFAULT_SETTINGS: Settings = {
  themes: [],
  counts: null,
  timers: { discussion: 0, vote: 0 },
  voice: true,
};

/** One host tap in the settings. */
export type SettingsChange =
  | { kind: "spies"; delta: 1 | -1 }
  | { kind: "white" }
  | { kind: "auto" }
  | { kind: "theme"; theme: string }
  /** Turns every theme on. */
  | { kind: "allThemes" }
  /** Cycles the timer to its next duration. */
  | { kind: "timer"; timer: "discussion" | "vote" }
  /** Turns "Chơi online" on or off. */
  | { kind: "voice" };

export const MAX_SPIES = 5;

export interface Room {
  code: string;
  hostId: number;
  players: Player[];
  /** Joined while a game was running; dealt in at the next game. */
  waiting: Player[];
  game: Game | null;
  gamesPlayed: number;
  scores: Record<number, number>;
  recentPairs: { key: string; at: number }[];
  settings: Settings;
}

export type GameEvent =
  | { type: "joined"; player: Player }
  | { type: "queued"; player: Player }
  | { type: "left"; player: Player }
  | { type: "host_changed"; hostId: number }
  | { type: "closed" }
  | { type: "settings_changed"; settings: Settings }
  | { type: "game_started"; game: Game }
  | { type: "round_started"; round: number; order: number[] }
  | { type: "vote_opened"; candidates: number[]; voters: number[]; revote: boolean }
  | { type: "vote_cast"; voterId: number; targetId: number; count: number; total: number }
  | { type: "vote_closed"; tally: Record<number, number> }
  | { type: "eliminated"; playerId: number; role: Role }
  | { type: "tie"; tied: number[] }
  | { type: "no_elimination"; reason: "tie" | "no_votes" }
  | { type: "white_guessing"; playerId: number }
  | { type: "white_guessed"; playerId: number; guess: string; correct: boolean }
  | { type: "game_ended"; winner: Side | null; game: Game };

export type GameError =
  | "already_in_room"
  | "not_in_room"
  | "not_host"
  | "too_few_players"
  | "game_running"
  | "no_game"
  | "wrong_phase"
  | "stale"
  | "not_alive"
  | "invalid_target"
  | "not_white"
  | "bad_counts"
  | "bad_setting";

export type Result = { ok: true; room: Room; events: GameEvent[] } | { ok: false; error: GameError };

const ok = (room: Room, events: GameEvent[]): Result => ({ ok: true, room, events });
const fail = (error: GameError): Result => ({ ok: false, error });

export function createRoom(code: string, host: Player): Room {
  return {
    code,
    hostId: host.id,
    players: [host],
    waiting: [],
    game: null,
    gamesPlayed: 0,
    scores: {},
    recentPairs: [],
    settings: DEFAULT_SETTINGS,
  };
}

export const isRunning = (room: Room): boolean => room.game !== null && room.game.phase !== "ended";
export const inRoom = (room: Room, id: number): boolean =>
  room.players.some((p) => p.id === id) || room.waiting.some((p) => p.id === id);
export const playerName = (room: Room, id: number): string =>
  [...room.players, ...room.waiting].find((p) => p.id === id)?.name ?? room.game?.names[id] ?? String(id);
export const handOf = (game: Game, id: number): Hand | undefined => game.hands.find((h) => h.playerId === id);

/** Tells apart players with the same display name: "Minh", "Minh (2)", "Minh (3)"… */
export function uniqueName(room: Room, name: string): string {
  const taken = new Set([...room.players, ...room.waiting].map((p) => p.name.toLocaleLowerCase("vi")));
  if (!taken.has(name.toLocaleLowerCase("vi"))) return name;
  for (let n = 2; ; n++) {
    const candidate = `${name} (${n})`;
    if (!taken.has(candidate.toLocaleLowerCase("vi"))) return candidate;
  }
}

export function join(room: Room, newcomer: Player): Result {
  if (inRoom(room, newcomer.id)) return fail("already_in_room");
  const player: Player = { ...newcomer, name: uniqueName(room, newcomer.name) };
  if (isRunning(room)) {
    return ok({ ...room, waiting: [...room.waiting, player] }, [{ type: "queued", player }]);
  }
  return ok({ ...room, players: [...room.players, player] }, [{ type: "joined", player }]);
}

export function leave(room: Room, playerId: number): Result {
  if (!inRoom(room, playerId)) return fail("not_in_room");
  const player = [...room.players, ...room.waiting].find((p) => p.id === playerId) as Player;
  let next: Room = {
    ...room,
    players: room.players.filter((p) => p.id !== playerId),
    waiting: room.waiting.filter((p) => p.id !== playerId),
  };
  const events: GameEvent[] = [{ type: "left", player }];

  if (next.players.length === 0 && next.waiting.length === 0) {
    return ok({ ...next, game: null }, [...events, { type: "closed" }]);
  }

  if (next.hostId === playerId) {
    const heir = next.players[0] ?? next.waiting[0];
    next = { ...next, hostId: (heir as Player).id };
    events.push({ type: "host_changed", hostId: next.hostId });
  }

  // Someone alive walking out of a running game counts as eliminated.
  const game = next.game;
  if (game && game.phase !== "ended" && game.alive.includes(playerId)) {
    const removed = removeFromGame(next, game, playerId);
    next = removed.room;
    events.push(...removed.events);
  } else if (game?.phase === "white_guess" && handOf(game, playerId)?.role === "white") {
    // Mr. White left instead of guessing: same as a wrong guess.
    const resumed = resumeAfterGuess(next, game, events);
    next = resumed.room;
    events.splice(0, events.length, ...resumed.events);
  }
  return ok(next, events);
}

function removeFromGame(room: Room, game: Game, playerId: number): { room: Room; events: GameEvent[] } {
  const role = (handOf(game, playerId) as Hand).role;
  const votes = Object.fromEntries(
    Object.entries(game.votes).filter(([voter, target]) => Number(voter) !== playerId && target !== playerId),
  );
  const g: Game = {
    ...game,
    alive: game.alive.filter((id) => id !== playerId),
    order: game.order.filter((id) => id !== playerId),
    candidates: game.candidates.filter((id) => id !== playerId),
    votes,
  };
  const events: GameEvent[] = [{ type: "eliminated", playerId, role }];
  // Mr. White who walks out does not get to guess.
  const after = afterElimination({ ...room, game: g }, g, events, { allowGuess: false });
  if (after.room.game?.phase === "voting" && allVoted(after.room.game)) {
    return closeVoteInternal(after.room, after.room.game, after.events);
  }
  return after;
}

/** Everyone who would be dealt in if the host started now. */
const seats = (room: Room) => room.players.length + room.waiting.length;

/** The role counts the next game will use: the host's choice, else the role table. null below 3 players. */
export function effectiveCounts(room: Room): RoleCounts | null {
  return room.settings.counts ?? (seats(room) >= MIN_PLAYERS ? defaultRoleCounts(seats(room)) : null);
}

/** Why the next game cannot start with these settings, or null. */
export function settingsProblem(room: Room): CountsProblem | null {
  const counts = effectiveCounts(room);
  return counts ? checkRoleCounts(seats(room), counts) : "too_few_players";
}

/**
 * Applies one host change. Role counts start from the table the first time the host
 * touches them, then stay fixed (AC5) until "auto" hands them back to the table.
 * @param allThemes every theme id, in display order
 */
export function configure(room: Room, by: number, change: SettingsChange, allThemes: readonly string[]): Result {
  if (by !== room.hostId) return fail("not_host");
  if (isRunning(room)) return fail("game_running");
  const current = room.settings;
  let next: Settings;
  switch (change.kind) {
    case "spies":
    case "white": {
      const base =
        current.counts ?? (seats(room) >= MIN_PLAYERS ? defaultRoleCounts(seats(room)) : { spies: 1, white: 0 });
      const counts =
        change.kind === "spies"
          ? { ...base, spies: Math.min(MAX_SPIES, Math.max(1, base.spies + change.delta)) }
          : { ...base, white: base.white > 0 ? 0 : 1 };
      next = { ...current, counts };
      break;
    }
    case "auto":
      next = { ...current, counts: null };
      break;
    case "allThemes":
      next = { ...current, themes: [] };
      break;
    case "timer": {
      const options: readonly number[] = TIMER_OPTIONS[change.timer];
      const at = options.indexOf(current.timers[change.timer]);
      const minutes = options[(at + 1) % options.length] as number;
      next = { ...current, timers: { ...current.timers, [change.timer]: minutes } };
      break;
    }
    case "voice":
      next = { ...current, voice: !current.voice };
      break;
    case "theme": {
      if (!allThemes.includes(change.theme)) return fail("bad_setting");
      const on = current.themes.length ? current.themes : [...allThemes];
      const toggled = on.includes(change.theme) ? on.filter((t) => t !== change.theme) : [...on, change.theme];
      if (toggled.length === 0) return fail("bad_setting");
      const ordered = allThemes.filter((t) => toggled.includes(t));
      next = { ...current, themes: ordered.length === allThemes.length ? [] : ordered };
      break;
    }
  }
  return ok({ ...room, settings: next }, [{ type: "settings_changed", settings: next }]);
}

export interface StartOptions {
  rng: Rng;
  /** Pairs of the room's themes. */
  pairs: readonly WordPair[];
  now: number;
}

export function start(room: Room, by: number, opts: StartOptions): Result {
  if (by !== room.hostId) return fail("not_host");
  if (isRunning(room)) return fail("game_running");

  const players = [...room.players, ...room.waiting];
  if (players.length < MIN_PLAYERS) return fail("too_few_players");

  const counts = effectiveCounts(room);
  if (!counts || checkRoleCounts(players.length, counts)) return fail("bad_counts");

  const recentPairs = room.recentPairs.filter((p) => opts.now - p.at < REPEAT_WINDOW_MS);
  const pool = leastRecent(opts.pairs, recentPairs);
  const pair = pool[Math.floor(opts.rng() * pool.length)] as WordPair;

  const hands = deal(
    players.map((p) => p.id),
    pair,
    counts,
    opts.rng,
  );
  const civilianWord = (hands.find((h) => h.role === "civilian") as Hand).word as string;
  const spyWord = (hands.find((h) => h.role === "spy") as Hand).word as string;
  const alive = players.map((p) => p.id);

  const game: Game = {
    id: room.gamesPlayed + 1,
    round: 1,
    phase: "describing",
    hands,
    alive,
    order: speakingOrder(alive, hands, opts.rng),
    votes: {},
    candidates: alive,
    revote: false,
    civilianWord,
    spyWord,
    winner: null,
    names: Object.fromEntries(players.map((p) => [p.id, p.name])),
  };
  const next: Room = {
    ...room,
    players,
    waiting: [],
    game,
    gamesPlayed: game.id,
    recentPairs: [...recentPairs, { key: pairKey(pair), at: opts.now }],
  };
  return ok(next, [
    { type: "game_started", game },
    { type: "round_started", round: 1, order: game.order },
  ]);
}

/** Pairs not played in the window; if every pair was, the ones played longest ago. */
function leastRecent(pairs: readonly WordPair[], recent: readonly { key: string; at: number }[]): WordPair[] {
  const lastPlayed = new Map<string, number>();
  for (const r of recent) lastPlayed.set(r.key, Math.max(r.at, lastPlayed.get(r.key) ?? 0));
  const fresh = pairs.filter((p) => !lastPlayed.has(pairKey(p)));
  if (fresh.length > 0) return fresh;
  const oldest = Math.min(...pairs.map((p) => lastPlayed.get(pairKey(p)) ?? 0));
  return pairs.filter((p) => (lastPlayed.get(pairKey(p)) ?? 0) === oldest);
}

export function pairKey(pair: WordPair): string {
  return [pair.a, pair.b]
    .map((w) => w.toLocaleLowerCase("vi"))
    .sort()
    .join("|");
}

/** Random order of living players; Mr. White never speaks first. */
export function speakingOrder(alive: readonly number[], hands: readonly Hand[], rng: Rng): number[] {
  const order = shuffle(alive, rng);
  const first = order[0];
  if (first !== undefined && order.length > 1 && hands.find((h) => h.playerId === first)?.role === "white") {
    const swapWith = 1 + Math.floor(rng() * (order.length - 1));
    [order[0], order[swapWith]] = [order[swapWith] as number, first];
  }
  return order;
}

export interface Turn {
  gameId: number;
  round: number;
}

function checkTurn(room: Room, by: number, turn: Turn | null, phase: Phase): Game | GameError {
  const game = room.game;
  if (!game) return "no_game";
  if (turn && (turn.gameId !== game.id || turn.round !== game.round)) return "stale";
  if (game.phase !== phase) return "wrong_phase";
  if (!room.players.some((p) => p.id === by)) return "not_in_room";
  return game;
}

export function openVote(room: Room, by: number, turn: Turn | null): Result {
  if (by !== room.hostId) return fail("not_host");
  const game = checkTurn(room, by, turn, "describing");
  if (typeof game === "string") return fail(game);
  const g: Game = { ...game, phase: "voting", votes: {}, candidates: game.alive, revote: false };
  return ok({ ...room, game: g }, [{ type: "vote_opened", candidates: g.candidates, voters: g.alive, revote: false }]);
}

export function vote(room: Room, voterId: number, targetId: number, turn: Turn | null): Result {
  const game = checkTurn(room, voterId, turn, "voting");
  if (typeof game === "string") return fail(game);
  if (!game.alive.includes(voterId)) return fail("not_alive");
  if (targetId === voterId || !game.candidates.includes(targetId)) return fail("invalid_target");

  const g: Game = { ...game, votes: { ...game.votes, [voterId]: targetId } };
  const count = Object.keys(g.votes).length;
  const events: GameEvent[] = [{ type: "vote_cast", voterId, targetId, count, total: g.alive.length }];
  const next = { ...room, game: g };
  if (allVoted(g)) {
    const closed = closeVoteInternal(next, g, events);
    return ok(closed.room, closed.events);
  }
  return ok(next, events);
}

export function closeVote(room: Room, by: number, turn: Turn | null): Result {
  if (by !== room.hostId) return fail("not_host");
  const game = checkTurn(room, by, turn, "voting");
  if (typeof game === "string") return fail(game);
  const closed = closeVoteInternal(room, game, []);
  return ok(closed.room, closed.events);
}

function allVoted(game: Game): boolean {
  return game.alive.every((id) => id in game.votes || !game.candidates.some((c) => c !== id));
}

function closeVoteInternal(room: Room, game: Game, events: GameEvent[]): { room: Room; events: GameEvent[] } {
  const tally: Record<number, number> = {};
  for (const target of Object.values(game.votes)) tally[target] = (tally[target] ?? 0) + 1;
  const out: GameEvent[] = [...events, { type: "vote_closed", tally }];

  const max = Math.max(0, ...Object.values(tally));
  if (max === 0) {
    out.push({ type: "no_elimination", reason: "no_votes" });
    return nextRound(room, game, out);
  }

  const top = Object.entries(tally)
    .filter(([, n]) => n === max)
    .map(([id]) => Number(id));

  if (top.length > 1) {
    if (game.revote) {
      out.push({ type: "no_elimination", reason: "tie" });
      return nextRound(room, game, out);
    }
    const g: Game = { ...game, votes: {}, candidates: top, revote: true };
    out.push({ type: "tie", tied: top }, { type: "vote_opened", candidates: top, voters: g.alive, revote: true });
    return { room: { ...room, game: g }, events: out };
  }

  const eliminatedId = top[0] as number;
  const role = (handOf(game, eliminatedId) as Hand).role;
  const g: Game = {
    ...game,
    alive: game.alive.filter((id) => id !== eliminatedId),
    order: game.order.filter((id) => id !== eliminatedId),
    votes: {},
  };
  out.push({ type: "eliminated", playerId: eliminatedId, role });
  return afterElimination({ ...room, game: g }, g, out, { allowGuess: true });
}

function afterElimination(
  room: Room,
  game: Game,
  events: GameEvent[],
  opts: { allowGuess: boolean },
): { room: Room; events: GameEvent[] } {
  const last = events.at(-1);
  if (opts.allowGuess && last?.type === "eliminated" && last.role === "white") {
    const g: Game = { ...game, phase: "white_guess" };
    return { room: { ...room, game: g }, events: [...events, { type: "white_guessing", playerId: last.playerId }] };
  }
  const winner = checkWinner(game);
  if (winner) return endGame(room, game, winner, events);
  if (game.phase === "voting" && opts.allowGuess) return nextRound(room, game, events);
  return { room: { ...room, game }, events };
}

export function checkWinner(game: Game): Side | null {
  const roleOf = (id: number) => handOf(game, id)?.role;
  const civilians = game.alive.filter((id) => roleOf(id) === "civilian").length;
  const others = game.alive.length - civilians;
  if (others === 0) return "civilians";
  if (civilians <= others) return "spies";
  return null;
}

function nextRound(room: Room, game: Game, events: GameEvent[]): { room: Room; events: GameEvent[] } {
  const order = speakingOrderStable(game);
  const g: Game = {
    ...game,
    round: game.round + 1,
    phase: "describing",
    votes: {},
    candidates: game.alive,
    revote: false,
    order,
  };
  return { room: { ...room, game: g }, events: [...events, { type: "round_started", round: g.round, order }] };
}

/**
 * Next round keeps the previous order minus eliminated players, rotated by one,
 * so the engine needs no RNG mid-game and Mr. White still never speaks first.
 */
function speakingOrderStable(game: Game): number[] {
  const order = game.order.filter((id) => game.alive.includes(id));
  const rotated = order.length > 1 ? [...order.slice(1), order[0] as number] : order;
  const first = rotated[0];
  if (first !== undefined && rotated.length > 1 && handOf(game, first)?.role === "white") {
    [rotated[0], rotated[1]] = [rotated[1] as number, first];
  }
  return rotated;
}

/** Case and extra spaces are ignored; Vietnamese diacritics are not. */
export function normalizeGuess(text: string): string {
  return text.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
}

export function guess(room: Room, playerId: number, text: string): Result {
  const game = room.game;
  if (!game) return fail("no_game");
  if (game.phase !== "white_guess") return fail("wrong_phase");
  if (handOf(game, playerId)?.role !== "white" || game.alive.includes(playerId)) return fail("not_white");

  const correct = normalizeGuess(text) === normalizeGuess(game.civilianWord);
  const events: GameEvent[] = [{ type: "white_guessed", playerId, guess: text.trim(), correct }];
  if (correct) return okFrom(endGame(room, game, "white", events));
  return okFrom(resumeAfterGuess(room, game, events));
}

function resumeAfterGuess(room: Room, game: Game, events: GameEvent[]): { room: Room; events: GameEvent[] } {
  const winner = checkWinner(game);
  if (winner) return endGame(room, game, winner, events);
  return nextRound(room, game, events);
}

export function end(room: Room, by: number): Result {
  if (by !== room.hostId) return fail("not_host");
  const game = room.game;
  if (!game || game.phase === "ended") return fail("no_game");
  return okFrom(endGame(room, game, null, []));
}

function endGame(
  room: Room,
  game: Game,
  winner: Side | null,
  events: GameEvent[],
): { room: Room; events: GameEvent[] } {
  const g: Game = { ...game, phase: "ended", winner };
  const scores = { ...room.scores };
  for (const id of winners(g)) scores[id] = (scores[id] ?? 0) + 1;
  return { room: { ...room, game: g, scores }, events: [...events, { type: "game_ended", winner, game: g }] };
}

/** Everyone on the winning side, alive or not. */
export function winners(game: Game): number[] {
  const sideOf: Record<Role, Side> = { civilian: "civilians", spy: "spies", white: "spies" };
  if (game.winner === null) return [];
  if (game.winner === "white") return game.hands.filter((h) => h.role === "white").map((h) => h.playerId);
  return game.hands.filter((h) => sideOf[h.role] === game.winner).map((h) => h.playerId);
}

const okFrom = (r: { room: Room; events: GameEvent[] }): Result => ok(r.room, r.events);
