"use client";

import { ToggleGroup, ToggleGroupItem } from "@cesuain/ui";
import { useState } from "react";
import { ACHIEVEMENT_CATEGORIES, CATEGORY_LABELS, type AchievementCategory } from "@/lib/achievements/catalog";
import type { AchievementProgress } from "@/lib/data/types";
import { progressRatio } from "@/lib/achievements/progress";
import AchievementCard from "./AchievementCard";

type StateFilter = "all" | "unlocked" | "locked";

export default function AchievementGallery({ achievements }: { achievements: AchievementProgress[] }) {
  const [category, setCategory] = useState<AchievementCategory | "all">("all");
  const [state, setState] = useState<StateFilter>("all");

  const visible = achievements.filter(
    (a) =>
      (category === "all" || a.category === category) &&
      (state === "all" || (state === "unlocked" ? Boolean(a.unlocked_at) : !a.unlocked_at)),
  );
  // Unlocked first, then the closest to unlocking.
  const sorted = [...visible].sort((a, b) => {
    if (Boolean(a.unlocked_at) !== Boolean(b.unlocked_at)) return a.unlocked_at ? -1 : 1;
    return a.unlocked_at ? 0 : progressRatio(b) - progressRatio(a);
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={category}
          onValueChange={(v) => v && setCategory(v as AchievementCategory | "all")}
          aria-label="Category"
          className="flex-wrap justify-start"
        >
          <ToggleGroupItem value="all">All categories</ToggleGroupItem>
          {ACHIEVEMENT_CATEGORIES.map((c) => (
            <ToggleGroupItem key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={state}
          onValueChange={(v) => v && setState(v as StateFilter)}
          aria-label="Status"
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="unlocked">Unlocked</ToggleGroupItem>
          <ToggleGroupItem value="locked">Locked</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <p className="sr-only" aria-live="polite">
        {sorted.length} achievements shown
      </p>
      {sorted.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">No achievements match these filters.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((a) => (
            <li key={a.id}>
              <AchievementCard achievement={a} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
