import type { GameWorld, RewardCode } from "@paw-time/api-contracts";
import islandCatalog from "@paw-time/game-catalog/employer-island";
import rewardEvents from "@paw-time/game-catalog/reward-events";

export { islandCatalog };

/** The obake that moves in when each island item unlocks (images in /public/obake). */
export const islandResident: Record<string, string> = {
  island_signboard: "hirunen",
  island_bench: "nakayoshi",
  island_lanterns: "totonou",
  island_pier: "sakura",
};

export function rewardExperience(code: RewardCode): number {
  return rewardEvents.events.find((event) => event.code === code)?.experience ?? 0;
}

export const employerRewardEvents = rewardEvents.events.filter(
  (event) => event.audience === "employer",
) as Array<{ code: RewardCode; audience: string; experience: number }>;

export type IslandProgress = {
  level: number;
  experience: number;
  /** 0–100 within the current level. */
  percent: number;
  nextLevel: { level: number; requiredExperience: number; unlocks: string[] } | null;
  remaining: number;
};

export function islandProgress(world: GameWorld | null): IslandProgress {
  const level = world?.level ?? 1;
  const experience = world?.experience ?? 0;
  const current = islandCatalog.levels.find((entry) => entry.level === level);
  const next = islandCatalog.levels.find((entry) => entry.level === level + 1) ?? null;
  if (!next) return { level, experience, percent: 100, nextLevel: null, remaining: 0 };
  const floor = current?.requiredExperience ?? 0;
  const span = next.requiredExperience - floor;
  const percent = Math.min(100, Math.max(0, Math.round(((experience - floor) / span) * 100)));
  return {
    level,
    experience,
    percent,
    nextLevel: next,
    remaining: Math.max(0, next.requiredExperience - experience),
  };
}
