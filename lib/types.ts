export const LANGUAGES = ["en", "pt-br"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LEVELS = ["basic", "intermediate", "advanced"] as const;
export type Level = (typeof LEVELS)[number];

/** Every question has one correct answer and exactly this many wrong answers. */
export const WRONG_ANSWER_COUNT = 3;

export const QUIZ_ID_PATTERN = /^[a-z0-9-]+$/;

export interface QuizQuestion {
  id: number;
  level: Level;
  question: string;
  correctAnswer: string;
  wrongAnswers: string[];
  /** Optional. Shown once the question is resolved. */
  explanation?: string;
}

export interface Quiz {
  id: string;
  language: Language;
  title: string;
  questions: QuizQuestion[];
}

export interface QuizSummary {
  id: string;
  titles: Record<Language, string>;
  counts: Record<Level, number>;
}

export function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}

export function isLevel(value: string): value is Level {
  return (LEVELS as readonly string[]).includes(value);
}
