import {
  Alert,
  AlertDescription,
  PageHeader,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderTitle,
  Progress,
  StatCard,
} from "@cesuain/ui";
import type { Metadata } from "next";
import AchievementGallery from "@/components/achievements/AchievementGallery";
import { nextMilestone, progressLabel } from "@/lib/achievements/progress";
import { getAchievements } from "@/lib/data/queries";

export const metadata: Metadata = { title: "Achievements" };

export default async function AchievementsPage() {
  const achievements = await getAchievements();
  const unlocked = achievements.filter((a) => a.unlocked_at);
  const next = nextMilestone(achievements);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader>
        <PageHeaderEyebrow>Achievements</PageHeaderEyebrow>
        <PageHeaderTitle>Your achievements</PageHeaderTitle>
        <PageHeaderDescription>
          Unlocked automatically from official quiz results. Custom practice does not count.
        </PageHeaderDescription>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard value={`${unlocked.length}/${achievements.length}`} label="Unlocked" />
        <StatCard
          value={`${achievements.length ? Math.round((unlocked.length / achievements.length) * 100) : 0}%`}
          label="Of the collection"
        />
        <StatCard value={next ? next.name : "All done"} label="Next milestone" description={next ? progressLabel(next) : undefined} />
      </div>
      <Progress
        value={achievements.length ? (unlocked.length / achievements.length) * 100 : 0}
        tone="brand"
        aria-label={`${unlocked.length} of ${achievements.length} achievements unlocked`}
      />

      {unlocked.length === 0 && (
        <Alert variant="info">
          <AlertDescription>
            No achievements yet. Complete your first official quiz to unlock First Steps.
          </AlertDescription>
        </Alert>
      )}

      <AchievementGallery achievements={achievements} />
    </div>
  );
}
