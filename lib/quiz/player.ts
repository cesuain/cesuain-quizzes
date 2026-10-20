import type { Level } from "../types";

/** View model shared by the official and the practice players. */

export const QUESTION_OUTCOMES = ["pending", "correct", "revealed", "timed_out"] as const;
export type QuestionOutcome = (typeof QUESTION_OUTCOMES)[number];

export interface PlayerOption {
  id: string;
  body: string;
}

export interface PlayerQuestion {
  id: string;
  level: Level;
  prompt: string;
  options: PlayerOption[];
  outcome: QuestionOutcome;
  submissions: number;
  /** Options already submitted, in order. */
  triedOptionIds: string[];
  /** Known only once the question is resolved. */
  correctOptionId: string | null;
  explanation: string | null;
}

export function isResolved(question: Pick<PlayerQuestion, "outcome">): boolean {
  return question.outcome !== "pending";
}

/** Index of the first unresolved question, or -1 when every question is resolved. */
export function firstPendingIndex(questions: readonly Pick<PlayerQuestion, "outcome">[]): number {
  return questions.findIndex((q) => q.outcome === "pending");
}
