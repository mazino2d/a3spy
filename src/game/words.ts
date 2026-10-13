import animals from "../../words/animals.json";
import body from "../../words/body.json";
import brands from "../../words/brands.json";
import clothes from "../../words/clothes.json";
import drinks from "../../words/drinks.json";
import festivals from "../../words/festivals.json";
import food from "../../words/food.json";
import fruits from "../../words/fruits.json";
import games from "../../words/games.json";
import home from "../../words/home.json";
import idioms from "../../words/idioms.json";
import jobs from "../../words/jobs.json";
import love from "../../words/love.json";
import movies from "../../words/movies.json";
import places from "../../words/places.json";
import school from "../../words/school.json";
import showbiz from "../../words/showbiz.json";
import sports from "../../words/sports.json";
import tech from "../../words/tech.json";
import vehicles from "../../words/vehicles.json";
import type { WordPair } from "./roles";

export interface WordPack {
  id: string;
  /** One emoji shown before the name in theme pickers. */
  emoji: string;
  name: string;
  pairs: readonly WordPair[];
}

interface RawPack {
  id: string;
  emoji: string;
  name: string;
  pairs: string[][];
}

function load(raw: RawPack): WordPack {
  return {
    id: raw.id,
    emoji: raw.emoji,
    name: raw.name,
    pairs: raw.pairs.map((pair) => {
      const [a, b, ...rest] = pair;
      if (a === undefined || b === undefined || rest.length > 0) {
        throw new Error(`words/${raw.id}.json: each pair needs exactly 2 words, got ${JSON.stringify(pair)}`);
      }
      return { a, b };
    }),
  };
}

/** Every theme, in the order pickers show them. A new file in words/ must be added here. */
export const PACKS: readonly WordPack[] = [
  food,
  drinks,
  places,
  home,
  body,
  showbiz,
  idioms,
  jobs,
  animals,
  tech,
  sports,
  school,
  vehicles,
  fruits,
  movies,
  brands,
  festivals,
  clothes,
  games,
  love,
].map(load);

export function pairsOf(packIds?: readonly string[]): WordPair[] {
  const packs = packIds?.length ? PACKS.filter((p) => packIds.includes(p.id)) : PACKS;
  return packs.flatMap((p) => p.pairs);
}
