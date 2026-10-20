import { Badge, Card, Progress, cn } from "@cesuain/ui";
import { Lock } from "lucide-react";
import { progressLabel, progressRatio } from "@/lib/achievements/progress";
import type { AchievementProgress } from "@/lib/data/types";
import { formatDate } from "@/lib/format";
import { AchievementIcon } from "./icons";

const RARITY_VARIANT = {
  common: "outline",
  uncommon: "success",
  rare: "primary",
  epic: "brand",
  legendary: "gradient",
} as const;

export default function AchievementCard({ achievement, compact = false }: { achievement: AchievementProgress; compact?: boolean }) {
  const unlocked = Boolean(achievement.unlocked_at);
  const ratio = progressRatio(achievement);
  const label = progressLabel(achievement);

  return (
    <Card variant={unlocked ? "gradient" : "solid"} className={cn("h-full", compact && "gap-3 p-4")}>
      <div className="flex items-start gap-4">
        <div
          aria-hidden
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-full border",
            unlocked ? "border-brand bg-brand/15 text-brand" : "border-border bg-muted text-muted-foreground",
          )}
        >
          {unlocked ? <AchievementIcon name={achievement.icon} className="size-6" /> : <Lock className="size-5" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-heading-sm text-foreground">{achievement.name}</h3>
            <Badge variant={RARITY_VARIANT[achievement.rarity as keyof typeof RARITY_VARIANT] ?? "outline"} size="sm">
              {achievement.rarity}
            </Badge>
          </div>
          <p className="text-body-sm text-muted-foreground">{achievement.description}</p>
        </div>
      </div>
      {unlocked ? (
        <p className="text-body-xs text-muted-foreground">
          <span className="sr-only">Unlocked. </span>Unlocked on {formatDate(achievement.unlocked_at!)}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Progress value={ratio * 100} size="sm" aria-label={`${achievement.name}: ${label}`} />
          <p className="text-body-xs text-muted-foreground">
            <span className="sr-only">Locked. </span>
            {label}
          </p>
        </div>
      )}
    </Card>
  );
}
