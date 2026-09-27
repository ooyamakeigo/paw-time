import type { GameWorld, RewardCode } from "@paw-time/api-contracts";
import employerIsland from "@paw-time/game-catalog/employer-island";
import rewardEvents from "@paw-time/game-catalog/reward-events";
import workerIsland from "@paw-time/game-catalog/worker-island";

type WorldLevel = { level: number; requiredExperience: number; unlocks: string[] };

const levelsByKind: Record<GameWorld["kind"], WorldLevel[]> = {
  employer_island: employerIsland.levels,
  worker_island: workerIsland.levels,
};

export function rewardExperience(code: RewardCode): number {
  const event = rewardEvents.events.find((candidate) => candidate.code === code);
  if (!event) throw new Error(`Unknown reward event: ${code}`);
  return event.experience;
}

export function levelFor(kind: GameWorld["kind"], experience: number): {
  level: number;
  unlocks: string[];
} {
  let level = 1;
  const unlocks: string[] = [];
  for (const entry of levelsByKind[kind]) {
    if (experience < entry.requiredExperience) break;
    level = entry.level;
    unlocks.push(...entry.unlocks);
  }
  return { level, unlocks };
}
