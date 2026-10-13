import type { Room } from "./engine";

/**
 * Reminder timers (docs/rules.md#timers). Pure: the room's Durable Object stores the
 * timer and sets an alarm for it. A timer belongs to one phase of one round; when the
 * phase moves on, the reminder no longer applies.
 */

export interface Timer {
  kind: "discussion" | "vote";
  /** Identifies the phase the timer was started for. */
  key: string;
  /** Epoch ms. */
  endsAt: number;
  /** Set once the reminder went out. */
  fired: boolean;
}

/** The phase a timer can belong to, or null when no timer applies. */
export function phaseKey(room: Room): { kind: Timer["kind"]; key: string } | null {
  const game = room.game;
  if (!game) return null;
  if (game.phase === "describing") return { kind: "discussion", key: `${game.id}:${game.round}:describing` };
  if (game.phase === "voting") return { kind: "vote", key: `${game.id}:${game.round}:voting:${game.revote ? 1 : 0}` };
  return null;
}

/** The timer after a command: kept while the phase lasts, started when a timed phase begins. */
export function nextTimer(room: Room, current: Timer | null, now: number): Timer | null {
  const phase = phaseKey(room);
  if (!phase) return null;
  if (current && current.key === phase.key) return current;
  const minutes = room.settings.timers[phase.kind];
  return minutes > 0 ? { kind: phase.kind, key: phase.key, endsAt: now + minutes * 60_000, fired: false } : null;
}

/** Whether the reminder should go out now. */
export function isDue(room: Room, timer: Timer | null, now: number): timer is Timer {
  return timer !== null && !timer.fired && now >= timer.endsAt && phaseKey(room)?.key === timer.key;
}
