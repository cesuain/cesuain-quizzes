"use client";

import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  EmptyStateContent,
  EmptyStateDescription,
  EmptyStateHeader,
  EmptyStateTitle,
  StatCard,
} from "@cesuain/ui";
import NextLink from "next/link";
import { useCallback, useState } from "react";
import PlayerHeader from "@/components/quiz/PlayerHeader";
import QuestionCard from "@/components/quiz/QuestionCard";
import QuestionNavigator from "@/components/quiz/QuestionNavigator";
import { PracticeError, answerPractice, practiceSummary, revealPractice, startPractice } from "@/lib/practice/session";
import { firstPendingIndex } from "@/lib/quiz/player";
import { formatPercent } from "@/lib/format";
import { usePractice } from "./PracticeProvider";

/** Plays a custom quiz with the shared engine UI. Everything stays in memory; nothing is sent anywhere. */
export default function PracticePlayer() {
  const { session, setSession, quiz } = usePractice();
  const [current, setCurrent] = useState(0);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = useCallback(
    (fn: () => void) => {
      try {
        setError(null);
        fn();
      } catch (e) {
        setError(e instanceof PracticeError ? e.message : "Something went wrong.");
      }
    },
    [],
  );

  const question = session?.questions[current];

  const answer = useCallback(
    (optionId: string | null) =>
      handle(() => {
        if (!session || !question) return;
        setSession(answerPractice(session, question.id, optionId).session);
      }),
    [handle, question, session, setSession],
  );

  const reveal = useCallback(
    () =>
      handle(() => {
        if (!session || !question) return;
        setSession(revealPractice(session, question.id));
      }),
    [handle, question, session, setSession],
  );

  const next = useCallback(() => {
    if (!session) return;
    const after = session.questions.findIndex((q, i) => i > current && q.outcome === "pending");
    const pending = after !== -1 ? after : firstPendingIndex(session.questions);
    if (pending === -1) setFinished(true);
    else setCurrent(pending);
  }, [current, session]);

  if (!session || !question) {
    return (
      <EmptyState>
        <EmptyStateHeader>
          <EmptyStateTitle>No practice quiz loaded</EmptyStateTitle>
          <EmptyStateDescription>
            Practice quizzes live only in memory, so they are gone after a refresh. Import your quiz JSON again to practice.
          </EmptyStateDescription>
        </EmptyStateHeader>
        <EmptyStateContent>
          <Button asChild variant="gradient">
            <NextLink href="/practice/import">Import quiz JSON</NextLink>
          </Button>
        </EmptyStateContent>
      </EmptyState>
    );
  }

  const summary = practiceSummary(session);
  const pendingIndex = firstPendingIndex(session.questions);
  const frontier = pendingIndex === -1 ? session.questions.length - 1 : pendingIndex;

  if (finished && summary.completed) {
    return (
      <Card variant="solid" className="mx-auto w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Practice complete: {session.quiz.title}</CardTitle>
          <CardDescription>This summary is temporary. It is not saved and does not count toward XP or achievements.</CardDescription>
        </CardHeader>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard value={formatPercent(summary.accuracy)} label="First-try accuracy" />
          <StatCard value={`${summary.correct}/${summary.total}`} label="Answered correctly" description="On any try" />
          <StatCard value={`${summary.firstTry}`} label="Right on the first try" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="gradient"
            onClick={() => {
              if (!quiz) return;
              setSession(startPractice(quiz, session.settings));
              setCurrent(0);
              setFinished(false);
            }}
            disabled={!quiz}
          >
            Practice again
          </Button>
          <Button variant="outline" onClick={() => setFinished(false)}>
            Review answers
          </Button>
          <Button asChild variant="ghost">
            <NextLink href="/practice/create">Create another quiz</NextLink>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PlayerHeader
        title={session.quiz.title}
        mode="custom_practice"
        resolved={summary.resolved}
        total={summary.total}
        stats={
          <span>
            Correct: <strong className="tabular-nums">{summary.correct}</strong>
          </span>
        }
        actions={
          summary.completed && (
            <Button size="sm" variant="outline" onClick={() => setFinished(true)}>
              Summary
            </Button>
          )
        }
      />
      <QuestionNavigator
        language={session.quiz.language}
        questions={session.questions}
        current={current}
        frontier={frontier}
        onSelect={setCurrent}
      />
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <QuestionCard
        key={question.id}
        language={session.quiz.language}
        question={question}
        index={current}
        total={session.questions.length}
        secondsPerQuestion={session.settings.secondsPerQuestion}
        isLast={summary.completed}
        reviewing={current !== frontier && question.outcome !== "pending"}
        onAnswer={answer}
        onReveal={reveal}
        onNext={next}
        nextLabel={summary.completed ? "See summary" : undefined}
      />
    </div>
  );
}
