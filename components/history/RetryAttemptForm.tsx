"use client";

import { Button } from "@cesuain/ui";
import { useActionState } from "react";
import { startAttemptAction } from "@/app/(app)/quizzes/actions";
import type { AttemptRow } from "@/lib/data/types";

/** Starts a new official attempt with the same settings. The previous attempt is kept as is. */
export default function RetryAttemptForm({ attempt }: { attempt: AttemptRow }) {
  const [state, action, pending] = useActionState(startAttemptAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="quizId" value={attempt.quiz_id} />
      <input type="hidden" name="language" value={attempt.language} />
      <input type="hidden" name="level" value={attempt.level_filter} />
      <input type="hidden" name="count" value={[10, 20, 50].includes(attempt.total_questions) ? attempt.total_questions : 0} />
      <input type="hidden" name="secondsPerQuestion" value={attempt.seconds_per_question} />
      <Button type="submit" variant="gradient" loading={pending}>
        Try again
      </Button>
      {state?.error && (
        <p role="alert" className="text-body-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
