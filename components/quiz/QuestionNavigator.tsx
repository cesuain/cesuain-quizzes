"use client";

import { cn } from "@cesuain/ui";
import { t } from "@/lib/i18n";
import type { PlayerQuestion } from "@/lib/quiz/player";
import type { Language } from "@/lib/types";

interface Props {
  language: Language;
  questions: PlayerQuestion[];
  current: number;
  /** Furthest question the user may open: resolved questions and the first pending one. */
  frontier: number;
  onSelect: (index: number) => void;
}

const TONE: Record<PlayerQuestion["outcome"], string> = {
  pending: "border-border bg-card text-muted-foreground",
  correct: "border-success bg-success/15 text-foreground",
  revealed: "border-warning bg-warning/15 text-foreground",
  timed_out: "border-destructive bg-destructive/15 text-foreground",
};

export default function QuestionNavigator({ language, questions, current, frontier, onSelect }: Props) {
  const s = t(language);
  return (
    <nav aria-label={s.questionNavigation}>
      <ol className="flex flex-wrap gap-1.5">
        {questions.map((question, index) => {
          const reachable = index <= frontier;
          return (
            <li key={question.id}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onSelect(index)}
                aria-current={index === current ? "step" : undefined}
                aria-label={`${s.questionShort(index + 1)}: ${s.outcome[question.outcome]}`}
                className={cn(
                  "grid size-8 place-items-center rounded-sm border text-label-xs tabular-nums focus-ring",
                  TONE[question.outcome],
                  index === current && "ring-2 ring-brand ring-offset-2 ring-offset-background",
                  reachable ? "cursor-pointer" : "cursor-not-allowed opacity-40",
                )}
              >
                {index + 1}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
