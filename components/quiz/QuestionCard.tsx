"use client";

import { Button, Card, Kbd, Spinner, cn } from "@cesuain/ui";
import { Check, Eye, X } from "lucide-react";
import { useEffect } from "react";
import { t } from "@/lib/i18n";
import type { PlayerQuestion } from "@/lib/quiz/player";
import type { Language } from "@/lib/types";
import LevelBadge from "./LevelBadge";
import { useCountdown } from "./useCountdown";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export interface QuestionCardProps {
  language: Language;
  question: PlayerQuestion;
  index: number;
  total: number;
  /** 0 means no time limit. */
  secondsPerQuestion: number;
  /** Option being submitted (`null` = timeout being submitted). */
  busyOptionId?: string | null;
  isLast: boolean;
  /** Reviewing an earlier, resolved question: no timer, no shortcuts that answer. */
  reviewing?: boolean;
  onAnswer: (optionId: string | null) => void;
  onReveal: () => void;
  onNext: () => void;
  /** Mode-specific feedback (e.g. XP earned for official attempts). */
  resolvedNote?: React.ReactNode;
  retryNote?: React.ReactNode;
  nextLabel?: string;
}

/**
 * One question of the quiz engine, shared by official attempts and custom practice. It only
 * renders state and reports what the user picked; scoring is the caller's job.
 */
export default function QuestionCard({
  language,
  question,
  index,
  total,
  secondsPerQuestion,
  busyOptionId,
  isLast,
  reviewing = false,
  onAnswer,
  onReveal,
  onNext,
  resolvedNote,
  retryNote,
  nextLabel,
}: QuestionCardProps) {
  const s = t(language);
  const resolved = question.outcome !== "pending";
  const busy = busyOptionId !== undefined;
  const countdown = useCountdown(secondsPerQuestion, !resolved && !busy && !reviewing, () => onAnswer(null));

  // Keyboard shortcuts: 1–N to answer, Enter to continue (same as the original quiz runner).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (!resolved && !busy) {
        const n = Number(event.key);
        const option = question.options[n - 1];
        if (option && !question.triedOptionIds.includes(option.id)) {
          event.preventDefault();
          onAnswer(option.id);
        }
      } else if (resolved && event.key === "Enter" && target?.tagName !== "BUTTON") {
        event.preventDefault();
        onNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resolved, busy, question, onAnswer, onNext]);

  const seconds = Math.ceil(countdown.remainingMs / 1000);
  const timerTone = countdown.percent <= 20 ? "bg-destructive" : countdown.percent <= 50 ? "bg-warning" : "bg-success";
  const feedbackId = `feedback-${question.id}`;

  return (
    <Card variant="solid" className="relative overflow-hidden pt-8">
      {countdown.enabled && !reviewing && (
        <div className="absolute inset-x-0 top-0 h-1.5 bg-muted" aria-hidden>
          <div
            className={cn("h-full transition-[width] duration-200 ease-linear", timerTone)}
            style={{ width: `${resolved ? 0 : countdown.percent}%` }}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-label-sm text-muted-foreground">{s.question(index + 1, total)}</span>
          <LevelBadge level={question.level} language={language} />
        </div>
        {countdown.enabled && !resolved && !reviewing && (
          <span
            className={cn("font-mono text-label-md tabular-nums", seconds <= 5 && "text-destructive")}
            role="timer"
            aria-label={s.secondsLeft(seconds)}
          >
            {seconds}s
          </span>
        )}
      </div>

      <h2 className="text-heading-md text-foreground whitespace-pre-line">{question.prompt}</h2>

      <ol className="flex flex-col gap-2.5" aria-describedby={feedbackId}>
        {question.options.map((option, i) => {
          const tried = question.triedOptionIds.includes(option.id);
          const isCorrect = resolved && option.id === question.correctOptionId;
          const isWrong = tried && !isCorrect;
          const dimmed = resolved && !isCorrect && !isWrong;
          const disabled = resolved || busy || tried;
          return (
            <li key={option.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onAnswer(option.id)}
                aria-label={`${LETTERS[i]}. ${option.body}${isCorrect ? ` (${s.correctAnswer})` : isWrong ? " ✗" : ""}`}
                className={cn(
                  "flex w-full items-start gap-3 rounded-item border border-border bg-card px-4 py-3 text-left text-body-md focus-ring",
                  "transition-colors duration-(--cds-duration-fast)",
                  !disabled && "cursor-pointer hover:border-brand hover:bg-accent",
                  isCorrect && "border-success bg-success/10",
                  isWrong && "border-destructive bg-destructive/10",
                  dimmed && "opacity-60",
                  disabled && !isCorrect && !isWrong && "cursor-default",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-sm border border-border bg-muted text-label-sm",
                    isCorrect && "border-success bg-success text-success-foreground",
                    isWrong && "border-destructive bg-destructive text-destructive-foreground",
                  )}
                >
                  {busyOptionId === option.id ? (
                    <Spinner size="sm" label={null} />
                  ) : isCorrect ? (
                    <Check className="size-4" />
                  ) : isWrong ? (
                    <X className="size-4" />
                  ) : (
                    LETTERS[i]
                  )}
                </span>
                <span className="whitespace-pre-line">{option.body}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div id={feedbackId} role="status" aria-live="polite" className="flex flex-col gap-3">
        {resolved ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p
                className={cn(
                  "text-label-md",
                  question.outcome === "correct" ? "text-success" : question.outcome === "timed_out" ? "text-destructive" : "text-foreground",
                )}
              >
                {question.outcome === "correct" ? s.correct : question.outcome === "timed_out" ? s.timeUp : s.revealed}
                {resolvedNote && <span className="ml-2 text-muted-foreground">{resolvedNote}</span>}
              </p>
              <Button variant="gradient" onClick={onNext} autoFocus={!reviewing}>
                {nextLabel ?? (isLast ? s.finish : s.next)}
              </Button>
            </div>
            {question.explanation && (
              <div className="rounded-item border border-border bg-muted/40 p-4 text-body-sm">
                <p className="mb-1 text-label-sm text-muted-foreground">{s.explanation}</p>
                <p className="whitespace-pre-line">{question.explanation}</p>
              </div>
            )}
          </>
        ) : question.submissions > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-label-md text-destructive">
              {s.wrong}
              {retryNote && <span className="ml-2 text-muted-foreground">{retryNote}</span>}
            </p>
            <Button variant="outline" size="sm" onClick={onReveal} disabled={busy}>
              <Eye aria-hidden className="size-4" />
              {s.reveal}
            </Button>
          </div>
        ) : (
          <p className="hidden text-body-sm text-muted-foreground sm:block">
            {s.keyboardHint.split(/(1–4|Enter)/).map((part, i) =>
              part === "1–4" || part === "Enter" ? <Kbd key={i}>{part}</Kbd> : part,
            )}
          </p>
        )}
      </div>
    </Card>
  );
}
