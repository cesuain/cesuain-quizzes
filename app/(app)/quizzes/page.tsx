import {
  Badge,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderTitle,
} from "@cesuain/ui";
import type { Metadata } from "next";
import NextLink from "next/link";
import { getCatalog, listAttempts } from "@/lib/data/queries";
import { formatPercent } from "@/lib/format";
import { LEVELS } from "@/lib/types";
import LevelBadge from "@/components/quiz/LevelBadge";

export const metadata: Metadata = { title: "Quizzes" };

export default async function QuizzesPage() {
  const [catalog, attempts] = await Promise.all([getCatalog(), listAttempts({ status: ["completed", "in_progress"] })]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader>
        <PageHeaderEyebrow>Official quizzes</PageHeaderEyebrow>
        <PageHeaderTitle>Quiz catalog</PageHeaderTitle>
        <PageHeaderDescription>
          Curated interview questions. Official attempts are saved, earn XP and unlock achievements.
        </PageHeaderDescription>
      </PageHeader>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {catalog.map((quiz) => {
          const mine = attempts.filter((a) => a.quiz_id === quiz.id);
          const completed = mine.filter((a) => a.status === "completed");
          const inProgress = mine.find((a) => a.status === "in_progress");
          const best = completed.reduce<number | null>((max, a) => Math.max(max ?? 0, a.accuracy ?? 0), null);
          const total = LEVELS.reduce((sum, level) => sum + quiz.counts[level], 0);
          return (
            <li key={quiz.id}>
              <Card interactive className="h-full">
                <CardHeader>
                  <CardTitle>
                    <NextLink href={`/quizzes/${quiz.id}`} className="after:absolute after:inset-0 focus-ring rounded-sm">
                      {quiz.titles.en}
                    </NextLink>
                  </CardTitle>
                  <CardDescription>{total} questions · English and Português</CardDescription>
                </CardHeader>
                <div className="flex flex-wrap gap-1.5">
                  {LEVELS.filter((level) => quiz.counts[level] > 0).map((level) => (
                    <LevelBadge key={level} level={level} />
                  ))}
                </div>
                <CardFooter className="flex-wrap text-body-sm text-muted-foreground">
                  {inProgress && <Badge variant="warning">In progress</Badge>}
                  {completed.length > 0 ? (
                    <span>
                      Completed {completed.length}× · best {formatPercent(best)}
                    </span>
                  ) : (
                    !inProgress && <span>Not attempted yet</span>
                  )}
                </CardFooter>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
