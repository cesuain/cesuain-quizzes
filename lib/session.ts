import type { Level, Quiz } from "./types";

export interface QuizSettings {
  level: Level | "all";
  /** Number of questions; 0 means all available. */
  count: number;
  /** Seconds per question; 0 means no time limit. */
  secondsPerQuestion: number;
}

export interface SessionQuestion {
  id: number;
  level: Level;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Picks and shuffles questions for one play-through, shuffling each question's options too.
 * Official attempts do the same selection in the database (`start_attempt`) so the answer key
 * never reaches the browser; custom practice runs it locally.
 */
export function buildSession(quiz: Quiz, settings: QuizSettings, random: () => number = Math.random): SessionQuestion[] {
  const pool = quiz.questions.filter((q) => settings.level === "all" || q.level === settings.level);
  const picked = shuffle(pool, random).slice(0, settings.count > 0 ? settings.count : pool.length);

  return picked.map((q) => {
    const options = shuffle([q.correctAnswer, ...q.wrongAnswers], random);
    return {
      id: q.id,
      level: q.level,
      question: q.question,
      options,
      correctIndex: options.indexOf(q.correctAnswer),
      explanation: q.explanation,
    };
  });
}
