import type { PublicEvent } from "../../src/game/view";

// Pure, no DOM: unit-tested in test/unit/web.test.ts.

const OUTCOME = new Set<PublicEvent["type"]>(["vote_closed", "tie", "no_elimination", "eliminated", "white_guessed"]);

/** The result of the last vote stays on screen until the next vote opens or a new game starts. */
export function nextOutcome(current: PublicEvent[], events: PublicEvent[]): PublicEvent[] {
  const eliminated = events.some((e) => e.type === "eliminated");
  const outcome = events.filter((e) => OUTCOME.has(e.type) || (e.type === "left" && eliminated));
  if (outcome.length) return outcome;
  if (events.some((e) => e.type === "game_started" || e.type === "vote_opened")) return [];
  return current;
}
