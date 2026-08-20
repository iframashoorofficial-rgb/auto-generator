/**
 * Photography packs.
 *
 * Formats reference photos by role ("establish", "friction", "method",
 * "result", "repetition") rather than by filename, so any pack can serve any
 * format regardless of how many frames it has.
 */

export type PhotoRole =
  | "establish"
  | "friction"
  | "method"
  | "result"
  | "repetition";

export interface Pack {
  id: string;
  name: string;
  keywords: string[];
  photos: Record<PhotoRole, string>;
}

/** Roles that read the same for any trade, so packs share them. */
const SHARED = {
  method: "/packs/shared-3.jpg",
  result: "/packs/shared-4.jpg",
};

export const PACKS: Pack[] = [
  {
    id: "office",
    name: "Office & services",
    keywords: [],
    photos: {
      establish: "/packs/office-1.jpg",
      friction: "/packs/office-2.jpg",
      repetition: "/packs/office-5.jpg",
      ...SHARED,
    },
  },
  {
    id: "water",
    name: "Water & utilities",
    keywords: [
      "water", "aqua", "hydra", "bottle", "jug", "tank", "filter", "purif",
      "plumb", "pool", "irrigat", "utility", "utilities", "gas", "energy", "gallon",
    ],
    photos: {
      establish: "/packs/water_1.jpg",
      friction: "/packs/water_2.jpg",
      repetition: "/packs/water_5.jpg",
      ...SHARED,
    },
  },
  {
    id: "food",
    name: "Food & hospitality",
    keywords: [
      "food", "restaurant", "cafe", "coffee", "bakery", "baker", "kitchen",
      "catering", "cater", "meal", "pizza", "grocer", "diner", "menu", "chef", "juice",
    ],
    photos: {
      establish: "/packs/food_1.jpg",
      friction: "/packs/food_2.jpg",
      repetition: "/packs/food_5.jpg",
      ...SHARED,
    },
  },
  {
    id: "trades",
    name: "Trades & repair",
    keywords: [
      "trade", "build", "construct", "electric", "roof", "paint", "carpent",
      "contractor", "landscap", "repair", "maintenance", "install", "renovat",
      "handyman", "hvac", "mechanic",
    ],
    photos: {
      establish: "/packs/trades_1.jpg",
      friction: "/packs/trades_2.jpg",
      repetition: "/packs/trades_5.jpg",
      ...SHARED,
    },
  },
  {
    id: "retail",
    name: "Retail & shipping",
    keywords: [
      "shop", "store", "retail", "ecommerce", "e-commerce", "boutique", "apparel",
      "fashion", "product", "ship", "deliver", "courier", "order", "warehouse",
      "logistic", "parcel", "stock",
    ],
    photos: {
      establish: "/packs/retail_1.jpg",
      friction: "/packs/retail_2.jpg",
      repetition: "/packs/retail_5.jpg",
      ...SHARED,
    },
  },
];

export function getPack(id: string): Pack {
  return PACKS.find((p) => p.id === id) ?? PACKS[0];
}

/** Choose a pack from free text — whichever pack's keywords appear most. */
export function matchPack(text: string): Pack {
  const hay = text.toLowerCase();
  let best = PACKS[0];
  let bestScore = 0;
  for (const pack of PACKS) {
    let score = 0;
    for (const k of pack.keywords) if (hay.includes(k)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = pack;
    }
  }
  return best;
}
