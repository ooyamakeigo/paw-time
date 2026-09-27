/**
 * The shop island, as the worker app draws it: one landmark per review tag,
 * grown only by how many workers said so. Shared by the API and the business app.
 * Mirrors apps/worker (ShopCulture / ShopLandmarks): same tags, same thresholds.
 */
export const SHOP_REVIEW_TAGS = ["on_time", "breaks", "instructions", "paid", "friendly", "fair", "again"] as const;
export type ShopReviewTag = (typeof SHOP_REVIEW_TAGS)[number];

export const SHOP_LANDMARK_IDS = [
  "clock_tower",
  "rest_grove",
  "guide_post",
  "payday_bell",
  "lantern_path",
  "fair_fountain",
  "welcome_arch",
] as const;
export type ShopLandmarkId = (typeof SHOP_LANDMARK_IDS)[number];

/** Which landmark each tag grows. */
export const SHOP_LANDMARK_FOR_TAG: Record<ShopReviewTag, ShopLandmarkId> = {
  on_time: "clock_tower",
  breaks: "rest_grove",
  instructions: "guide_post",
  paid: "payday_bell",
  friendly: "lantern_path",
  fair: "fair_fountain",
  again: "welcome_arch",
};

/** Votes needed for level 1, 2 and 3. Levels never go down: counts, not shares. */
export const SHOP_LANDMARK_LEVELS = [3, 8, 16] as const;
/** One or two votes show a sprout. */
export const SHOP_SPROUT_MIN = 1;
/** Averages and landmarks are only shown once this many different workers answered. */
export const SHOP_FEEDBACK_MIN_RESPONSES = 5;

export function shopLandmarkLevel(votes: number): 0 | 1 | 2 | 3 {
  let level: 0 | 1 | 2 | 3 = 0;
  SHOP_LANDMARK_LEVELS.forEach((threshold, index) => {
    if (votes >= threshold) level = (index + 1) as 1 | 2 | 3;
  });
  return level;
}

/** The island's terrain stage grows with the total of landmark levels, as in the worker app. */
export function shopIslandStage(totalLevel: number): 0 | 1 | 2 {
  return totalLevel < 6 ? 0 : totalLevel < 12 ? 1 : 2;
}
