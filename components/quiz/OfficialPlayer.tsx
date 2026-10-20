"use client";

import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
} from "@cesuain/ui";
import { Sparkles } from "lucide-react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { abandonAttemptAction, revealAnswerAction, submitAnswerAction } from "@/app/(app)/quizzes/actions";
import { notifyAchievements } from "@/components/achievements/notify";
import { xpForSubmission } from "@/lib/domain/scoring";
import { toPlayerQuestion, type AttemptDetails, type AttemptSummary } from "@/lib/data/types";
import { firstPendingIndex, type PlayerQuestion } from "@/lib/quiz/player";
import PlayerHeader from "./PlayerHeader";
import QuestionCard from "./QuestionCard";
import QuestionNavigator from "./QuestionNavigator";

interface Props {
  details: AttemptDetails;
}

export default function OfficialPlayer({ details }: Props) {
  const router = useRouter();
  const { attempt } = details;
  const [questions, setQuestions] = useState<PlayerQuestion[]>(() => details.questions.map(toPlayerQuestion));
  const [xpByQuestion, setXpByQuestion] = useState<Record<string, number>>(() =>
    Object.fromEntries(details.questions.map((q) => [q.question_id, q.xp_awarded])),
  );
  const [summary, setSummary] = useState<AttemptSummary>(attempt);
  const [current, setCurrent] = useState(() => Math.max(0, firstPendingIndex(questions)));
  const [busyOptionId, setBusyOptionId] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [abandoning, startAbandon] = useTransition();
  // One event id per (question, choice) until the server confirms it, so retrying after a
  // network error replays the same submission instead of creating a new one.
  const pendingEvents = useRef(new Map<string, string>());

  const frontierPending = firstPendingIndex(questions);
  const frontier = frontierPending === -1 ? questions.length - 1 : frontierPending;
  const question = questions[current];
  const completed = summary.status === "completed";
  const resolvedCount = questions.filter((q) => q.outcome !== "pending").length;

  const replaceQuestion = useCallback((next: PlayerQuestion) => {
    setQuestions((prev) => prev.map((q) => (q.id === next.id ? next : q)));
  }, []);

  const answer = useCallback(
    async (optionId: string | null) => {
      if (busyOptionId !== undefined || question.outcome !== "pending" || completed) return;
      const key = `${question.id}:${optionId ?? "timeout"}`;
      const clientEventId = pendingEvents.current.get(key) ?? crypto.randomUUID();
      pendingEvents.current.set(key, clientEventId);
      setBusyOptionId(optionId);
      setError(null);
      try {
        const result = await submitAnswerAction({ attemptId: attempt.id, questionId: question.id, optionId, clientEventId });
        if (!result.ok) {
          setError(result.error);
          if (result.code === "question_resolved" || result.code === "attempt_closed" || result.code === "option_already_tried") {
            router.refresh();
          }
          return;
        }
        pendingEvents.current.delete(key);
        replaceQuestion(toPlayerQuestion(result.data.question));
        setXpByQuestion((prev) => ({ ...prev, [question.id]: result.data.question.xp_awarded }));
        setSummary(result.data.attempt);
        notifyAchievements(result.data.unlocked_achievements);
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
      } finally {
        setBusyOptionId(undefined);
      }
    },
    [attempt.id, busyOptionId, completed, question, replaceQuestion, router],
  );

  const reveal = useCallback(async () => {
    if (busyOptionId !== undefined) return;
    setBusyOptionId(null);
    setError(null);
    try {
      const result = await revealAnswerAction({ attemptId: attempt.id, questionId: question.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      replaceQuestion(toPlayerQuestion(result.data.question));
      setSummary(result.data.attempt);
      notifyAchievements(result.data.unlocked_achievements);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusyOptionId(undefined);
    }
  }, [attempt.id, busyOptionId, question.id, replaceQuestion]);

  const next = useCallback(() => {
    if (completed) {
      router.push(`/results/${attempt.id}`);
      return;
    }
    const after = questions.findIndex((q, i) => i > current && q.outcome === "pending");
    const pending = after !== -1 ? after : firstPendingIndex(questions);
    if (pending !== -1) setCurrent(pending);
  }, [attempt.id, completed, current, questions, router]);

  const xpNote = useMemo(() => {
    if (question.outcome !== "correct") return null;
    const xp = xpByQuestion[question.id] ?? 0;
    return xp > 0 ? `+${xp} XP` : "No XP after two tries";
  }, [question, xpByQuestion]);

  const nextWorth = xpForSubmission("official", question.submissions + 1, true);
  const isLast = completed || frontierPending === -1;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PlayerHeader
        title={details.quiz_title}
        mode="official"
        resolved={resolvedCount}
        total={questions.length}
        stats={
          <>
            <span>
              XP this attempt: <strong className="tabular-nums">{summary.xp_earned + summary.completion_bonus}</strong>
            </span>
            <span>
              First try: <strong className="tabular-nums">{summary.first_try_count}</strong>
            </span>
          </>
        }
        actions={
          !completed && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  Abandon
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Abandon this attempt?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You keep the XP already earned, but the attempt ends and the 500 XP completion bonus is no longer
                    available. To come back later instead, just leave this page: your progress is saved.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep playing</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={abandoning}
                    onClick={() => startAbandon(async () => void (await abandonAttemptAction(attempt.id, attempt.quiz_id)))}
                  >
                    Abandon attempt
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )
        }
      />

      <QuestionNavigator
        language={attempt.language}
        questions={questions}
        current={current}
        frontier={frontier}
        onSelect={setCurrent}
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {completed && (
        <Alert variant="success">
          <Sparkles aria-hidden />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Quiz complete! +{summary.completion_bonus} XP completion bonus · {summary.xp_earned + summary.completion_bonus} XP
              in total.
            </span>
            <Button asChild size="sm" variant="gradient">
              <NextLink href={`/results/${attempt.id}`}>See results</NextLink>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <QuestionCard
        key={question.id}
        language={attempt.language}
        question={question}
        index={current}
        total={questions.length}
        secondsPerQuestion={attempt.seconds_per_question}
        busyOptionId={busyOptionId}
        isLast={isLast}
        reviewing={current !== frontier && question.outcome !== "pending"}
        onAnswer={answer}
        onReveal={reveal}
        onNext={next}
        resolvedNote={xpNote}
        retryNote={nextWorth > 0 ? `A correct answer now earns ${nextWorth} XP.` : "Further correct answers earn no XP."}
      />
    </div>
  );
}
