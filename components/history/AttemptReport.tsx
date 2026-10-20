import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableRow,
} from "@cesuain/ui";
import { Check, Eye, Timer, X } from "lucide-react";
import NextLink from "next/link";
import { AchievementIcon } from "@/components/achievements/icons";
import LevelBadge from "@/components/quiz/LevelBadge";
import type { AttemptDetails, AttemptQuestionDto } from "@/lib/data/types";
import { formatDateTime, formatDuration, formatPercent } from "@/lib/format";
import { LANGUAGE_LABELS, levelLabels } from "@/lib/i18n";
import { LEVELS } from "@/lib/types";
import AttemptStatusBadge from "./AttemptStatusBadge";
import RetryAttemptForm from "./RetryAttemptForm";

interface Props {
  details: AttemptDetails;
  /** `results`: summary and mistakes. `history`: every submission of every question. */
  view: "results" | "history";
}

function verdict(pct: number): string {
  return pct >= 90 ? "Outstanding!" : pct >= 70 ? "Great job!" : pct >= 50 ? "Good effort — keep practicing." : "Keep studying, you'll get there.";
}

const OUTCOME_LABEL: Record<AttemptQuestionDto["outcome"], string> = {
  pending: "Not answered",
  correct: "Correct",
  revealed: "Revealed",
  timed_out: "Timed out",
};

export default function AttemptReport({ details, view }: Props) {
  const { attempt, questions, responses } = details;
  const accuracy = attempt.accuracy ?? (attempt.total_questions ? (attempt.first_try_count / attempt.total_questions) * 100 : 0);
  const totalXp = attempt.xp_earned + attempt.completion_bonus;
  const firstTryXp = responses.filter((r) => r.xp_awarded === 50).length;
  const secondTryXp = responses.filter((r) => r.xp_awarded === 25).length;
  const optionText = new Map(questions.flatMap((q) => q.options.map((o) => [o.id, o.body] as const)));
  const responsesByQuestion = Map.groupBy(responses, (r) => r.question_id);

  const byLevel = LEVELS.map((level) => {
    const qs = questions.filter((q) => q.level === level);
    return {
      level,
      total: qs.length,
      firstTry: qs.filter((q) => q.outcome === "correct" && q.submissions === 1).length,
      correct: qs.filter((q) => q.outcome === "correct").length,
    };
  }).filter((row) => row.total > 0);

  const listed = view === "results" ? questions.filter((q) => !(q.outcome === "correct" && q.submissions === 1)) : questions;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2 text-body-sm text-muted-foreground">
        <AttemptStatusBadge status={attempt.status} />
        <span>
          {LANGUAGE_LABELS[attempt.language]} · {attempt.level_filter === "all" ? "All levels" : levelLabels.en[attempt.level_filter]} ·{" "}
          {attempt.total_questions} questions · started {formatDateTime(attempt.started_at)}
          {attempt.completed_at && ` · finished ${formatDateTime(attempt.completed_at)}`}
        </span>
      </div>

      {attempt.status === "completed" && <p className="text-heading-md text-foreground">{verdict(accuracy)}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard value={formatPercent(accuracy)} label="Accuracy" description={`${attempt.first_try_count} of ${attempt.total_questions} right on the first try`} />
        <StatCard value={`${totalXp}`} label="XP earned" description={attempt.completion_bonus ? "Including the 500 XP completion bonus" : "No completion bonus yet"} />
        <StatCard value={`${attempt.correct_count}/${attempt.total_questions}`} label="Answered correctly" description="On any try" />
        <StatCard value={formatDuration(attempt.duration_seconds)} label="Time" description={`About ${formatDuration(attempt.duration_seconds / Math.max(1, attempt.questions_answered))} per question`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>XP breakdown</CardTitle>
            <CardDescription>Awarded and recorded by the server.</CardDescription>
          </CardHeader>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell>Correct on the first try</TableCell>
                <TableCell className="text-right tabular-nums">{firstTryXp} × 50</TableCell>
                <TableCell className="text-right tabular-nums">{firstTryXp * 50}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Correct on the second try</TableCell>
                <TableCell className="text-right tabular-nums">{secondTryXp} × 25</TableCell>
                <TableCell className="text-right tabular-nums">{secondTryXp * 25}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Completion bonus</TableCell>
                <TableCell className="text-right">{attempt.completion_bonus ? "Completed" : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{attempt.completion_bonus}</TableCell>
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell className="text-right tabular-nums">{totalXp} XP</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By level</CardTitle>
            <CardDescription>First-try accuracy per level.</CardDescription>
          </CardHeader>
          <ul className="flex flex-col gap-4">
            {byLevel.map((row) => (
              <li key={row.level} className="grid grid-cols-[7rem_1fr_4rem] items-center gap-3">
                <LevelBadge level={row.level} />
                <Progress
                  value={(row.firstTry / row.total) * 100}
                  tone="brand"
                  aria-label={`${levelLabels.en[row.level]}: ${row.firstTry} of ${row.total} on the first try`}
                />
                <span className="text-right text-body-sm tabular-nums">
                  {row.firstTry}/{row.total}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {details.unlocked_achievements.length > 0 && (
        <Card variant="gradient">
          <CardHeader>
            <CardTitle>Achievements unlocked in this attempt</CardTitle>
          </CardHeader>
          <ul className="flex flex-wrap gap-2">
            {details.unlocked_achievements.map((a) => (
              <li key={a.slug}>
                <Badge variant="brand" size="md">
                  <AchievementIcon name={a.icon} aria-hidden className="size-3.5" />
                  {a.name}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{view === "results" ? "Review" : "Answer history"}</CardTitle>
          <CardDescription>
            {view === "results"
              ? listed.length === 0
                ? "Perfect run: every question right on the first try."
                : "Questions that needed more than one try."
              : "Every submission, in order, with the time each one took."}
          </CardDescription>
        </CardHeader>
        <ol className="flex flex-col gap-5">
          {listed.map((q) => {
            const submitted = responsesByQuestion.get(q.question_id) ?? [];
            const correctText = q.correct_option_id ? optionText.get(q.correct_option_id) : null;
            return (
              <li key={q.question_id} className="flex flex-col gap-2 border-b border-border pb-5 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-label-sm text-muted-foreground">#{q.position}</span>
                  <LevelBadge level={q.level} language={attempt.language} />
                  <Badge variant={q.outcome === "correct" ? "success" : q.outcome === "pending" ? "outline" : "destructive"} size="sm">
                    {OUTCOME_LABEL[q.outcome]}
                    {q.outcome === "correct" && q.submissions > 1 && ` on try ${q.submissions}`}
                  </Badge>
                  {q.xp_awarded > 0 && <span className="text-body-xs text-muted-foreground">+{q.xp_awarded} XP</span>}
                </div>
                <p className="text-label-md whitespace-pre-line text-foreground">{q.prompt}</p>
                <ul className="flex flex-col gap-1 text-body-sm">
                  {submitted.map((r) => (
                    <li key={r.id} className={r.is_correct ? "text-success" : "text-destructive"}>
                      <span className="inline-flex items-center gap-1.5">
                        {r.option_id === null ? <Timer aria-hidden className="size-4" /> : r.is_correct ? <Check aria-hidden className="size-4" /> : <X aria-hidden className="size-4" />}
                        <span className="sr-only">{r.is_correct ? "Correct" : "Wrong"} answer {r.submission_number}:</span>
                        {r.option_id === null ? "Time ran out" : optionText.get(r.option_id)}
                      </span>
                      {view === "history" && (
                        <span className="ml-2 text-muted-foreground">
                          · try {r.submission_number} · {formatDuration(r.duration_ms / 1000)}
                          {r.xp_awarded > 0 && ` · +${r.xp_awarded} XP`}
                        </span>
                      )}
                    </li>
                  ))}
                  {q.outcome === "revealed" && (
                    <li className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Eye aria-hidden className="size-4" /> Answer revealed
                    </li>
                  )}
                </ul>
                {correctText && q.outcome !== "correct" && (
                  <p className="text-body-sm">
                    <span className="text-muted-foreground">Correct answer: </span>
                    <span className="text-success">{correctText}</span>
                  </p>
                )}
                {q.explanation && <p className="text-body-sm text-muted-foreground whitespace-pre-line">{q.explanation}</p>}
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="flex flex-wrap gap-3">
        {attempt.status === "in_progress" ? (
          <Button asChild variant="gradient">
            <NextLink href={`/quizzes/${attempt.quiz_id}/play?attempt=${attempt.id}`}>Resume attempt</NextLink>
          </Button>
        ) : (
          <RetryAttemptForm attempt={attempt} />
        )}
        <Button asChild variant="outline">
          <NextLink href={`/quizzes/${attempt.quiz_id}`}>Quiz details</NextLink>
        </Button>
        {view === "results" ? (
          <Button asChild variant="ghost">
            <NextLink href={`/history/${attempt.id}`}>Full answer history</NextLink>
          </Button>
        ) : (
          <Button asChild variant="ghost">
            <NextLink href="/history">All attempts</NextLink>
          </Button>
        )}
      </div>
    </div>
  );
}
