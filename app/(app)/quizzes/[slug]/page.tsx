import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cesuain/ui";
import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import AttemptStatusBadge from "@/components/history/AttemptStatusBadge";
import LevelBadge from "@/components/quiz/LevelBadge";
import StartQuizForm from "@/components/quiz/StartQuizForm";
import { getCatalogEntry, listAttempts } from "@/lib/data/queries";
import { formatDateTime, formatPercent } from "@/lib/format";
import { LANGUAGE_LABELS, levelLabels } from "@/lib/i18n";
import { LEVELS } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/quizzes/[slug]">): Promise<Metadata> {
  const quiz = await getCatalogEntry((await params).slug);
  return { title: quiz?.titles.en ?? "Quiz" };
}

export default async function QuizDetailsPage({ params }: PageProps<"/quizzes/[slug]">) {
  const { slug } = await params;
  const quiz = await getCatalogEntry(slug);
  if (!quiz) notFound();
  const attempts = await listAttempts({ quizId: quiz.id, limit: 20 });
  const inProgress = attempts.filter((a) => a.status === "in_progress");
  const total = LEVELS.reduce((sum, level) => sum + quiz.counts[level], 0);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader>
        <PageHeaderEyebrow>Official quiz</PageHeaderEyebrow>
        <PageHeaderTitle>{quiz.titles.en}</PageHeaderTitle>
        <PageHeaderDescription>
          {total} questions in English and Português. Each correct first answer earns 50 XP, a correct second answer
          25 XP, and finishing the attempt adds a 500 XP bonus.
        </PageHeaderDescription>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card variant="solid">
          <CardHeader>
            <CardTitle>Start an attempt</CardTitle>
            <CardDescription>Questions and options are shuffled on every attempt.</CardDescription>
          </CardHeader>
          <CardContent>
            <StartQuizForm quiz={quiz} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          {inProgress.length > 0 && (
            <Card variant="gradient">
              <CardHeader>
                <CardTitle>Continue where you left off</CardTitle>
                <CardDescription>Official progress is saved after every answer.</CardDescription>
              </CardHeader>
              <ul className="flex flex-col gap-3">
                {inProgress.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-body-sm">
                      {a.questions_answered}/{a.total_questions} answered · {LANGUAGE_LABELS[a.language]} · started{" "}
                      {formatDateTime(a.started_at)}
                    </span>
                    <Button asChild size="sm" variant="gradient">
                      <NextLink href={`/quizzes/${quiz.id}/play?attempt=${a.id}`}>Resume</NextLink>
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Questions by level</CardTitle>
            </CardHeader>
            <ul className="flex flex-wrap gap-4">
              {LEVELS.map((level) => (
                <li key={level} className="flex items-center gap-2 text-body-sm">
                  <LevelBadge level={level} /> {quiz.counts[level]} {levelLabels.en[level].toLowerCase()} questions
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your attempts</CardTitle>
            </CardHeader>
            {attempts.length === 0 ? (
              <p className="text-body-sm text-muted-foreground">No attempts yet. Your results will appear here.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Started</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Accuracy</TableHead>
                    <TableHead className="text-right">XP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <NextLink
                          className="underline-offset-4 hover:underline focus-ring rounded-sm"
                          href={a.status === "in_progress" ? `/quizzes/${quiz.id}/play?attempt=${a.id}` : `/history/${a.id}`}
                        >
                          {formatDateTime(a.started_at)}
                        </NextLink>
                      </TableCell>
                      <TableCell>
                        <AttemptStatusBadge status={a.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatPercent(a.accuracy)}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.xp_earned + a.completion_bonus}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
