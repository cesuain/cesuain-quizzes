import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderTitle,
  Progress,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cesuain/ui";
import type { Metadata } from "next";
import LevelBadge from "@/components/quiz/LevelBadge";
import XpByDayChart, { type DayXp } from "@/components/stats/XpByDayChart";
import { progressionFor } from "@/lib/domain/progression";
import { getCatalog, getStats, listAttempts, listXpSince } from "@/lib/data/queries";
import { overallAccuracy } from "@/lib/data/types";
import { formatDuration, formatNumber, formatPercent } from "@/lib/format";
import { levelLabels } from "@/lib/i18n";
import { LEVELS } from "@/lib/types";

export const metadata: Metadata = { title: "Progress" };

const DAYS = 30;

function lastDays(count: number): string[] {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (count - 1 - i)));
    return d.toISOString().slice(0, 10);
  });
}

export default async function ProgressPage() {
  const days = lastDays(DAYS);
  const [stats, attempts, catalog, xp] = await Promise.all([
    getStats(),
    listAttempts({ status: "completed" }),
    getCatalog(),
    listXpSince(new Date(`${days[0]}T00:00:00Z`)),
  ]);
  const progression = progressionFor(stats.total_xp);

  const perDay = new Map(days.map((d) => [d, 0]));
  for (const entry of xp) {
    const day = entry.created_at.slice(0, 10);
    if (perDay.has(day)) perDay.set(day, perDay.get(day)! + entry.amount);
  }
  const series: DayXp[] = days.map((date) => ({ date, xp: perDay.get(date) ?? 0 }));

  const byQuiz = catalog
    .map((quiz) => {
      const done = attempts.filter((a) => a.quiz_id === quiz.id);
      return {
        id: quiz.id,
        title: quiz.titles.en,
        completed: done.length,
        best: done.length ? Math.max(...done.map((a) => a.accuracy ?? 0)) : null,
        average: done.length ? done.reduce((s, a) => s + (a.accuracy ?? 0), 0) / done.length : null,
        xp: done.reduce((s, a) => s + a.xp_earned + a.completion_bonus, 0),
        time: done.reduce((s, a) => s + a.duration_seconds, 0),
      };
    })
    .filter((row) => row.completed > 0);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader>
        <PageHeaderEyebrow>Progress</PageHeaderEyebrow>
        <PageHeaderTitle>Your progress</PageHeaderTitle>
        <PageHeaderDescription>Derived from official quiz attempts only. Custom practice is never counted.</PageHeaderDescription>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard value={`Lv ${progression.level}`} label={`${formatNumber(stats.total_xp)} XP`} description={`${formatNumber(progression.nextLevelXp - progression.xp)} XP to level ${progression.level + 1}`} />
        <StatCard value={formatPercent(overallAccuracy(stats))} label="Accuracy" description="First-try correct, completed attempts" />
        <StatCard value={formatDuration(stats.total_time_seconds)} label="Learning time" description="Time spent answering official questions" />
        <StatCard value={`${stats.best_streak}`} label="Best streak" description={`Current streak: ${stats.current_streak}`} />
      </div>

      <Progress value={progression.percent} tone="brand" aria-label={`Level ${progression.level}: ${progression.percent}% of the way to level ${progression.level + 1}`} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card variant="solid">
          <CardHeader>
            <CardTitle>XP over time</CardTitle>
          </CardHeader>
          <XpByDayChart days={series} />
        </Card>

        <Card variant="solid">
          <CardHeader>
            <CardTitle>Accuracy by level</CardTitle>
            <CardDescription>Share of resolved questions answered right on the first try.</CardDescription>
          </CardHeader>
          <ul className="flex flex-col gap-4">
            {LEVELS.map((level) => {
              const row = stats.by_level[level];
              const pct = row && row.questions ? (row.first_try / row.questions) * 100 : 0;
              return (
                <li key={level} className="grid grid-cols-[7rem_1fr_5rem] items-center gap-3">
                  <LevelBadge level={level} />
                  <Progress value={pct} tone="brand" aria-label={`${levelLabels.en[level]}: ${formatPercent(pct)} first-try accuracy`} />
                  <span className="text-right text-body-sm tabular-nums">
                    {row ? `${row.first_try}/${row.questions}` : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-body-sm text-muted-foreground">
            {formatNumber(stats.correct_answers)} correct answers · {formatNumber(stats.first_try_correct)} on the first try ·{" "}
            {formatNumber(stats.submissions)} submissions
          </p>
        </Card>
      </div>

      <Card variant="solid">
        <CardHeader>
          <CardTitle>By quiz</CardTitle>
        </CardHeader>
        {byQuiz.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">Complete an official quiz to see per-quiz statistics.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quiz</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">Best</TableHead>
                <TableHead className="text-right">Average</TableHead>
                <TableHead className="text-right">Time</TableHead>
                <TableHead className="text-right">XP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byQuiz.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.title}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.completed}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(row.best)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(row.average)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatDuration(row.time)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(row.xp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
