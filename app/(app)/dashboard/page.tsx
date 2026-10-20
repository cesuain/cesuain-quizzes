import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderTitle,
  Progress,
  StatCard,
} from "@cesuain/ui";
import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import NextLink from "next/link";
import AchievementCard from "@/components/achievements/AchievementCard";
import AttemptTable from "@/components/history/AttemptTable";
import { nextMilestone } from "@/lib/achievements/progress";
import { getCurrentUser } from "@/lib/auth";
import { getAchievements, getStats, listAttempts, quizTitles } from "@/lib/data/queries";
import { overallAccuracy } from "@/lib/data/types";
import { progressionFor } from "@/lib/domain/progression";
import { formatDuration, formatNumber, formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [user, stats, inProgress, recent, achievements, titles] = await Promise.all([
    getCurrentUser(),
    getStats(),
    listAttempts({ status: "in_progress", limit: 5 }),
    listAttempts({ status: ["completed", "abandoned"], limit: 5 }),
    getAchievements(),
    quizTitles(),
  ]);
  const progression = progressionFor(stats.total_xp);
  const recentUnlocks = achievements
    .filter((a) => a.unlocked_at)
    .sort((a, b) => b.unlocked_at!.localeCompare(a.unlocked_at!))
    .slice(0, 3);
  const next = nextMilestone(achievements);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader>
        <PageHeaderEyebrow>Dashboard</PageHeaderEyebrow>
        <PageHeaderTitle>Welcome back{user?.displayName ? `, ${user.displayName}` : ""}</PageHeaderTitle>
        <PageHeaderDescription>Official quiz XP, results and achievements in one place.</PageHeaderDescription>
        <PageHeaderActions>
          <Button asChild variant="gradient">
            <NextLink href="/quizzes">Start a quiz</NextLink>
          </Button>
          <Button asChild variant="outline">
            <NextLink href="/practice/create">
              <Sparkles aria-hidden className="size-4" /> Custom Quiz Generator
            </NextLink>
          </Button>
        </PageHeaderActions>
      </PageHeader>

      <Card variant="solid" className="gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-heading-sm text-foreground">Level {progression.level}</p>
          <p className="text-body-sm text-muted-foreground tabular-nums">
            {formatNumber(progression.xp)} / {formatNumber(progression.nextLevelXp)} XP
          </p>
        </div>
        <Progress
          value={progression.percent}
          tone="brand"
          aria-label={`Level ${progression.level}: ${progression.percent}% of the way to level ${progression.level + 1}`}
        />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard value={formatNumber(stats.total_xp)} label="Total XP" />
        <StatCard value={formatNumber(stats.completed_attempts)} label="Quizzes completed" />
        <StatCard value={formatNumber(stats.correct_answers)} label="Correct answers" />
        <StatCard value={formatPercent(overallAccuracy(stats))} label="Accuracy" description="First try" />
        <StatCard value={formatDuration(stats.total_time_seconds)} label="Learning time" />
      </div>

      {inProgress.length > 0 && (
        <Card variant="gradient">
          <CardHeader>
            <CardTitle>In progress</CardTitle>
            <CardDescription>Pick up where you left off. Official progress is saved after every answer.</CardDescription>
          </CardHeader>
          <AttemptTable attempts={inProgress} titles={titles} caption="Attempts in progress" />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card variant="solid">
          <CardHeader>
            <CardTitle>Recent attempts</CardTitle>
          </CardHeader>
          {recent.length === 0 ? (
            <p className="text-body-sm text-muted-foreground">
              No finished attempts yet.{" "}
              <NextLink href="/quizzes" className="underline underline-offset-4 focus-ring rounded-xs">
                Start your first official quiz
              </NextLink>
              .
            </p>
          ) : (
            <AttemptTable attempts={recent} titles={titles} caption="Recent attempts" />
          )}
        </Card>

        <div className="flex flex-col gap-4">
          {next && (
            <section aria-labelledby="next-milestone" className="flex flex-col gap-3">
              <h2 id="next-milestone" className="text-heading-sm text-foreground">
                Next milestone
              </h2>
              <AchievementCard achievement={next} compact />
            </section>
          )}
          <section aria-labelledby="recent-achievements" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 id="recent-achievements" className="text-heading-sm text-foreground">
                Recent achievements
              </h2>
              <NextLink href="/achievements" className="text-body-sm underline-offset-4 hover:underline focus-ring rounded-xs">
                View all
              </NextLink>
            </div>
            {recentUnlocks.length === 0 ? (
              <p className="text-body-sm text-muted-foreground">Nothing unlocked yet. Finish a quiz to earn First Steps.</p>
            ) : (
              recentUnlocks.map((a) => <AchievementCard key={a.id} achievement={a} compact />)
            )}
          </section>
        </div>
      </div>

      <Card variant="glass" className="sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-heading-sm text-foreground">Custom Quiz Generator</h2>
          <p className="text-body-sm text-muted-foreground">
            Practice any topic: describe it, get a ChatGPT prompt, paste the JSON back and play. Practice is not saved and
            earns no XP.
          </p>
        </div>
        <Button asChild variant="gradient">
          <NextLink href="/practice/create">
            <Sparkles aria-hidden className="size-4" /> Create a practice quiz
          </NextLink>
        </Button>
      </Card>
    </div>
  );
}
