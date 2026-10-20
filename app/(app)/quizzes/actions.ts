"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { errorCode, errorMessage, type DataErrorCode } from "@/lib/data/errors";
import type { AnswerResult, RevealResult } from "@/lib/data/types";
import { COUNT_OPTIONS, TIME_OPTIONS } from "@/lib/quiz/settings";
import { createClient } from "@/lib/supabase/server";
import { LANGUAGES, LEVELS, QUIZ_ID_PATTERN } from "@/lib/types";

/**
 * Official quiz mutations. They only forward *which* attempt, question and option the user
 * picked: correctness, XP, completion and achievements are decided by the database functions.
 */

export type ActionResult<T> = { ok: true; data: T } | { ok: false; code: DataErrorCode | "invalid_input"; error: string };

const startSchema = z.object({
  quizId: z.string().regex(QUIZ_ID_PATTERN),
  language: z.enum(LANGUAGES),
  level: z.enum([...LEVELS, "all"]),
  count: z.coerce.number().refine((n) => (COUNT_OPTIONS as readonly number[]).includes(n)),
  secondsPerQuestion: z.coerce.number().refine((n) => (TIME_OPTIONS as readonly number[]).includes(n)),
});

export type StartState = { error: string } | undefined;

export async function startAttemptAction(_previous: StartState, formData: FormData): Promise<StartState> {
  await requireUser();
  const parsed = startSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Choose valid quiz settings." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_attempt", {
    p_quiz_id: parsed.data.quizId,
    p_language: parsed.data.language,
    p_level: parsed.data.level,
    p_count: parsed.data.count,
    p_seconds_per_question: parsed.data.secondsPerQuestion,
  });
  if (error || !data) return { error: errorMessage(error?.message ?? "") };
  redirect(`/quizzes/${parsed.data.quizId}/play?attempt=${data}`);
}

const answerSchema = z.object({
  attemptId: z.uuid(),
  questionId: z.uuid(),
  /** null when the question's timer ran out. */
  optionId: z.uuid().nullable(),
  /** Generated once per submission in the browser; makes retries idempotent. */
  clientEventId: z.uuid(),
});

const revealSchema = answerSchema.pick({ attemptId: true, questionId: true });

function failure(message: string): { ok: false; code: DataErrorCode; error: string } {
  return { ok: false, code: errorCode(message), error: errorMessage(message) };
}

export async function submitAnswerAction(input: z.input<typeof answerSchema>): Promise<ActionResult<AnswerResult>> {
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_input", error: "Invalid answer." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_answer", {
    p_attempt_id: parsed.data.attemptId,
    p_question_id: parsed.data.questionId,
    p_option_id: parsed.data.optionId,
    p_client_event_id: parsed.data.clientEventId,
  });
  if (error) return failure(error.message);
  return { ok: true, data: data as unknown as AnswerResult };
}

export async function revealAnswerAction(input: z.input<typeof revealSchema>): Promise<ActionResult<RevealResult>> {
  const parsed = revealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_input", error: "Invalid request." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reveal_answer", {
    p_attempt_id: parsed.data.attemptId,
    p_question_id: parsed.data.questionId,
  });
  if (error) return failure(error.message);
  return { ok: true, data: data as unknown as RevealResult };
}

export async function abandonAttemptAction(attemptId: string, quizId: string): Promise<ActionResult<null>> {
  const parsed = z.object({ attemptId: z.uuid(), quizId: z.string().regex(QUIZ_ID_PATTERN) }).safeParse({ attemptId, quizId });
  if (!parsed.success) return { ok: false, code: "invalid_input", error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("abandon_attempt", { p_attempt_id: parsed.data.attemptId });
  if (error) return failure(error.message);
  redirect(`/quizzes/${parsed.data.quizId}`);
}
