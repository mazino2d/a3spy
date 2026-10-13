import body from "../../words/body.json";
import food from "../../words/food.json";
import places from "../../words/places.json";
import showbiz from "../../words/showbiz.json";
import type { WordPair } from "./roles";

export interface WordPack {
  id: string;
  name: string;
  pairs: readonly WordPair[];
}

interface RawPack {
  id: string;
  name: string;
  pairs: string[][];
}

function load(raw: RawPack): WordPack {
  return {
    id: raw.id,
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

export const PACKS: readonly WordPack[] = [food, places, body, showbiz].map(load);

export function pairsOf(packIds?: readonly string[]): WordPair[] {
  const packs = packIds?.length ? PACKS.filter((p) => packIds.includes(p.id)) : PACKS;
  return packs.flatMap((p) => p.pairs);
}
