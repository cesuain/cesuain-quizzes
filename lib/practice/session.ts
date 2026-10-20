import { buildSession, type QuizSettings } from "../session";
import type { PlayerQuestion, QuestionOutcome } from "../quiz/player";
import type { Language, Quiz } from "../types";

/**
 * Custom practice engine. Runs entirely in browser memory: there is no persistence, no XP and
 * no achievement hook here by design (see lib/domain/modes.ts). Results are deliberately typed
 * without any XP fields.
 */

export const PRACTICE_MODE = "custom_practice" as const;

export interface PracticeSession {
  mode: typeof PRACTICE_MODE;
  quiz: { id: string; title: string; language: Language };
  settings: QuizSettings;
  questions: PlayerQuestion[];
  /** Correct option id per question id. Practice content is the user's own, so it lives here. */
  answerKey: Readonly<Record<string, string>>;
  explanations: Readonly<Record<string, string | null>>;
  startedAt: number;
}

export interface PracticeAnswerResult {
  isCorrect: boolean;
  submissionNumber: number;
  outcome: QuestionOutcome;
}

export interface PracticeSummary {
  total: number;
  resolved: number;
  correct: number;
  firstTry: number;
  completed: boolean;
  /** First-try share, 0–100. */
  accuracy: number;
}

export class PracticeError extends Error {}

export function startPractice(quiz: Quiz, settings: QuizSettings, random: () => number = Math.random): PracticeSession {
  const picked = buildSession(quiz, settings, random);
  if (picked.length === 0) throw new PracticeError("No questions match these settings.");

  const answerKey: Record<string, string> = {};
  const explanations: Record<string, string | null> = {};
  const questions = picked.map((q): PlayerQuestion => {
    const id = String(q.id);
    const options = q.options.map((body, index) => ({ id: `${id}:${index}`, body }));
    answerKey[id] = options[q.correctIndex].id;
    explanations[id] = q.explanation ?? null;
    return {
      id,
      level: q.level,
      prompt: q.question,
      options,
      outcome: "pending",
      submissions: 0,
      triedOptionIds: [],
      correctOptionId: null,
      explanation: null,
    };
  });

  return {
    mode: PRACTICE_MODE,
    quiz: { id: quiz.id, title: quiz.title, language: quiz.language },
    settings,
    questions,
    answerKey,
    explanations,
    startedAt: Date.now(),
  };
}

function updateQuestion(
  session: PracticeSession,
  questionId: string,
  update: (question: PlayerQuestion) => PlayerQuestion,
): PracticeSession {
  const index = session.questions.findIndex((q) => q.id === questionId);
  if (index < 0) throw new PracticeError("Unknown question.");
  const questions = [...session.questions];
  questions[index] = update(questions[index]);
  return { ...session, questions };
}

function resolve(session: PracticeSession, question: PlayerQuestion, outcome: QuestionOutcome): PlayerQuestion {
  return {
    ...question,
    outcome,
    correctOptionId: session.answerKey[question.id],
    explanation: session.explanations[question.id],
  };
}

/** Submits an option (or `null` when the timer ran out). Same retry rules as official attempts. */
export function answerPractice(
  session: PracticeSession,
  questionId: string,
  optionId: string | null,
): { session: PracticeSession; result: PracticeAnswerResult } {
  let result: PracticeAnswerResult | undefined;
  const next = updateQuestion(session, questionId, (question) => {
    if (question.outcome !== "pending") throw new PracticeError("This question is already resolved.");
    if (optionId !== null) {
      if (!question.options.some((o) => o.id === optionId)) throw new PracticeError("Unknown option.");
      if (question.triedOptionIds.includes(optionId)) throw new PracticeError("Option already tried.");
    }
    const isCorrect = optionId !== null && session.answerKey[question.id] === optionId;
    const submissionNumber = question.submissions + 1;
    const outcome: QuestionOutcome = isCorrect ? "correct" : optionId === null ? "timed_out" : "pending";
    result = { isCorrect, submissionNumber, outcome };
    const updated: PlayerQuestion = {
      ...question,
      submissions: submissionNumber,
      triedOptionIds: optionId === null ? question.triedOptionIds : [...question.triedOptionIds, optionId],
    };
    return outcome === "pending" ? updated : resolve(session, updated, outcome);
  });
  return { session: next, result: result! };
}

/** Gives up on a question after at least one wrong answer. */
export function revealPractice(session: PracticeSession, questionId: string): PracticeSession {
  return updateQuestion(session, questionId, (question) => {
    if (question.outcome !== "pending") return question;
    if (question.submissions === 0) throw new PracticeError("Answer the question before revealing it.");
    return resolve(session, question, "revealed");
  });
}

export function practiceSummary(session: PracticeSession): PracticeSummary {
  const total = session.questions.length;
  const resolved = session.questions.filter((q) => q.outcome !== "pending").length;
  const correct = session.questions.filter((q) => q.outcome === "correct").length;
  const firstTry = session.questions.filter((q) => q.outcome === "correct" && q.submissions === 1).length;
  return {
    total,
    resolved,
    correct,
    firstTry,
    completed: resolved === total,
    accuracy: total ? Math.round((firstTry / total) * 10000) / 100 : 0,
  };
}
