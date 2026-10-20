import { MODE_POLICIES, type QuizMode } from "./modes";

/**
 * XP rules. The database (`private.xp_for_submission`, `private.completion_bonus`) is the
 * authority and awards XP; this module only mirrors the rules so the UI can say what an answer
 * is worth. A test keeps both in sync.
 */
export const XP_FIRST_TRY = 50;
export const XP_SECOND_TRY = 25;
export const COMPLETION_BONUS_XP = 500;

/** XP a submission is worth. `submissionNumber` is 1 for the first answer to a question. */
export function xpForSubmission(mode: QuizMode, submissionNumber: number, isCorrect: boolean): number {
  if (!MODE_POLICIES[mode].awardsXp || !isCorrect) return 0;
  if (submissionNumber === 1) return XP_FIRST_TRY;
  if (submissionNumber === 2) return XP_SECOND_TRY;
  return 0;
}

export function completionBonus(mode: QuizMode): number {
  return MODE_POLICIES[mode].awardsXp ? COMPLETION_BONUS_XP : 0;
}

/** Share of questions answered correctly on the first try, as a 0–100 percentage. */
export function accuracyPercent(firstTryCorrect: number, totalQuestions: number): number {
  if (totalQuestions <= 0) return 0;
  return Math.round((firstTryCorrect / totalQuestions) * 10000) / 100;
}
