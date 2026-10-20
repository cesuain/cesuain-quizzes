import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@cesuain/ui";
import NextLink from "next/link";
import type { AttemptRow } from "@/lib/data/types";
import { formatDateTime, formatDuration, formatPercent } from "@/lib/format";
import { LANGUAGE_LABELS } from "@/lib/i18n";
import AttemptStatusBadge from "./AttemptStatusBadge";

interface Props {
  attempts: AttemptRow[];
  titles: Record<string, Record<string, string>>;
  caption?: string;
}

export function attemptHref(attempt: Pick<AttemptRow, "id" | "quiz_id" | "status">): string {
  return attempt.status === "in_progress"
    ? `/quizzes/${attempt.quiz_id}/play?attempt=${attempt.id}`
    : attempt.status === "completed"
      ? `/results/${attempt.id}`
      : `/history/${attempt.id}`;
}

export default function AttemptTable({ attempts, titles, caption }: Props) {
  return (
    <Table>
      {caption && <caption className="sr-only">{caption}</caption>}
      <TableHeader>
        <TableRow>
          <TableHead>Quiz</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Progress</TableHead>
          <TableHead className="text-right">Accuracy</TableHead>
          <TableHead className="text-right">Time</TableHead>
          <TableHead className="text-right">XP</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {attempts.map((a) => (
          <TableRow key={a.id}>
            <TableCell>
              <NextLink href={attemptHref(a)} className="font-medium underline-offset-4 hover:underline focus-ring rounded-sm">
                {titles[a.quiz_id]?.[a.language] ?? a.quiz_id}
              </NextLink>
              <span className="block text-body-xs text-muted-foreground">{LANGUAGE_LABELS[a.language]}</span>
            </TableCell>
            <TableCell className="whitespace-nowrap">{formatDateTime(a.started_at)}</TableCell>
            <TableCell>
              <AttemptStatusBadge status={a.status} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {a.questions_answered}/{a.total_questions}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatPercent(a.accuracy)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatDuration(a.duration_seconds)}</TableCell>
            <TableCell className="text-right tabular-nums">{a.xp_earned + a.completion_bonus}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
