"use client";

import { Alert, AlertDescription, Button, FieldLegend, FieldSet, ToggleGroup, ToggleGroupItem } from "@cesuain/ui";
import { useActionState, useState } from "react";
import { startAttemptAction } from "@/app/(app)/quizzes/actions";
import { LANGUAGE_LABELS, levelLabels } from "@/lib/i18n";
import { COUNT_OPTIONS, TIME_OPTIONS } from "@/lib/quiz/settings";
import { LANGUAGES, LEVELS, type Language, type Level, type QuizSummary } from "@/lib/types";

interface Props {
  quiz: QuizSummary;
}

function Choice<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (value: T) => void;
}) {
  return (
    <FieldSet>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <input type="hidden" name={name} value={value} />
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={value}
        onValueChange={(next) => next && onChange(next as T)}
        className="flex-wrap justify-start"
        aria-label={legend}
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </FieldSet>
  );
}

/** Official quiz settings, as in the original setup screen. The server picks the questions. */
export default function StartQuizForm({ quiz }: Props) {
  const [state, action, pending] = useActionState(startAttemptAction, undefined);
  const [language, setLanguage] = useState<Language>("en");
  const [level, setLevel] = useState<Level | "all">("all");
  const [count, setCount] = useState("10");
  const [seconds, setSeconds] = useState("30");

  const available = level === "all" ? LEVELS.reduce((sum, l) => sum + quiz.counts[l], 0) : quiz.counts[level];

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="quizId" value={quiz.id} />
      <Choice
        legend="Language"
        name="language"
        value={language}
        onChange={setLanguage}
        options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }))}
      />
      <Choice
        legend="Level"
        name="level"
        value={level}
        onChange={setLevel}
        options={[
          { value: "all" as const, label: "All levels" },
          ...LEVELS.map((l) => ({ value: l, label: levelLabels.en[l], disabled: quiz.counts[l] === 0 })),
        ]}
      />
      <Choice
        legend="Questions"
        name="count"
        value={count}
        onChange={setCount}
        options={COUNT_OPTIONS.map((n) => ({ value: String(n), label: n === 0 ? `All (${available})` : String(n) }))}
      />
      <Choice
        legend="Time per question"
        name="secondsPerQuestion"
        value={seconds}
        onChange={setSeconds}
        options={TIME_OPTIONS.map((n) => ({ value: String(n), label: n === 0 ? "No limit" : `${n}s` }))}
      />
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" variant="gradient" size="lg" loading={pending} disabled={available === 0}>
        Start official attempt
      </Button>
    </form>
  );
}
