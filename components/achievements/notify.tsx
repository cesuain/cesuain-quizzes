"use client";

import { toast } from "@cesuain/ui";
import type { UnlockedAchievement } from "@/lib/data/types";
import { AchievementIcon } from "./icons";

/**
 * Announces achievements the server just unlocked. The server returns each unlock only once
 * (the insert that created it), so refreshes and retried requests never notify again.
 */
export function notifyAchievements(unlocked: readonly Pick<UnlockedAchievement, "id" | "name" | "description" | "icon">[]) {
  for (const achievement of unlocked) {
    toast(`Achievement unlocked: ${achievement.name}`, {
      id: `achievement-${achievement.id}`,
      description: achievement.description,
      duration: 7000,
      icon: <AchievementIcon name={achievement.icon} aria-hidden className="size-4 text-brand animate-achievement-pop" />,
    });
  }
}
