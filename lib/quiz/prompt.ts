import { LIMITS } from "./schema";
import { LANGUAGES, LEVELS, WRONG_ANSWER_COUNT, type Language, type Level, type QuizQuestion } from "../types";

/**
 * Builds a ChatGPT-ready prompt whose output can be pasted straight into the practice importer.
 * Every rule below comes from the constants that the schema in ./schema.ts validates, and the
 * example is a real question from data/quizzes, so the prompt cannot drift from the format.
 */

export const QUESTION_TYPES = [
  {
    id: "multiple_choice",
    label: "Single-answer multiple choice",
    description: `One correct answer and ${WRONG_ANSWER_COUNT} wrong answers, shuffled into ${WRONG_ANSWER_COUNT + 1} options.`,
  },
] as const;

export const DIFFICULTIES = [...LEVELS, "mixed"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const QUESTION_COUNT_RANGE = { min: 1, max: 50 } as const;

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  "pt-br": "Brazilian Portuguese",
};

export interface PromptRequest {
  topic: string;
  objectives: string;
  difficulty: Difficulty;
  questionCount: number;
  language: Language;
  context: string;
  instructions: string;
}

export interface PromptExample {
  quizId: string;
  language: Language;
  title: string;
  question: QuizQuestion;
}

export function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return slug || "custom-quiz";
}

function difficultyRule(difficulty: Difficulty, count: number): string {
  if (difficulty === "mixed") {
    return `Spread the questions across the levels: about a third "basic", a third "intermediate" and a third "advanced" (${count} questions in total).`;
  }
  return `Every question must be "${difficulty}" and set "level": "${difficulty}".`;
}

const LEVEL_MEANING: Record<Level, string> = {
  basic: "definitions and core concepts someone new to the topic should know",
  intermediate: "applying concepts, comparing alternatives and common pitfalls",
  advanced: "edge cases, internals, trade-offs and expert-level reasoning",
};

export function hasPromptInput(request: Pick<PromptRequest, "topic" | "objectives" | "instructions">): boolean {
  return [request.topic, request.objectives, request.instructions].some((v) => v.trim().length > 0);
}

export function buildQuizPrompt(request: PromptRequest, example: PromptExample): string {
  const count = Math.min(QUESTION_COUNT_RANGE.max, Math.max(QUESTION_COUNT_RANGE.min, Math.round(request.questionCount)));
  const topic = request.topic.trim();
  const subject = topic || "the subject described in the instructions below";
  const slug = slugify(topic || request.instructions || "custom quiz");
  const language = LANGUAGE_NAMES[request.language];

  const brief = [
    `Topic: ${topic || "(see the instructions below)"}`,
    request.objectives.trim() && `Concepts and learning objectives to cover:\n${request.objectives.trim()}`,
    `Difficulty: ${request.difficulty === "mixed" ? "mixed (basic, intermediate and advanced)" : request.difficulty}`,
    `Number of questions: exactly ${count}`,
    `Language of every text field: ${language}`,
    request.context.trim() && `Context and source material (base the questions on it):\n"""\n${request.context.trim()}\n"""`,
    request.instructions.trim() && `Additional instructions from the learner:\n${request.instructions.trim()}`,
  ].filter(Boolean);

  const exampleQuestion: QuizQuestion = {
    ...example.question,
    explanation: example.question.explanation ?? "<one or two sentences explaining why correctAnswer is right>",
  };
  const exampleJson = JSON.stringify(
    { id: example.quizId, language: example.language, title: example.title, questions: [exampleQuestion] },
    null,
    2,
  );

  return `You are an expert educator writing a practice quiz about ${subject}. Produce the quiz as one JSON object that follows the format below exactly. It will be validated by a strict parser and rejected if it deviates.

# What to write
${brief.join("\n\n")}

# Question type
Only one question type is supported: single-answer multiple choice. Each question has exactly one correct answer ("correctAnswer") and exactly ${WRONG_ANSWER_COUNT} wrong answers ("wrongAnswers"). Do not list the options separately and do not give them ids or letters: the app builds the ${WRONG_ANSWER_COUNT + 1} options from "correctAnswer" plus "wrongAnswers" and shuffles them. The answer key is the "correctAnswer" text itself.

# JSON format
The top-level object has exactly these fields:
- "id" (string): a short slug made of lowercase letters, digits and hyphens. Use "${slug}".
- "language" (string): "${request.language}". Allowed values: ${LANGUAGES.map((l) => `"${l}"`).join(", ")}.
- "title" (string, at most ${LIMITS.title} characters): a short title for the quiz.
- "questions" (array): exactly ${count} question objects.

Each question object has exactly these fields:
- "id" (integer): unique within the quiz. Number the questions 1, 2, 3… in order.
- "level" (string): one of ${LEVELS.map((l) => `"${l}"`).join(", ")}. ${difficultyRule(request.difficulty, count)}
- "question" (string, at most ${LIMITS.question} characters): the question text.
- "correctAnswer" (string, at most ${LIMITS.answer} characters): the one correct answer.
- "wrongAnswers" (array of exactly ${WRONG_ANSWER_COUNT} strings, each at most ${LIMITS.answer} characters): answers that are plausible but definitely wrong.
- "explanation" (string, at most ${LIMITS.explanation} characters): one or two sentences explaining why "correctAnswer" is right.

Do not add any other field anywhere. Unknown fields are rejected.

Level meanings: ${LEVELS.map((l) => `"${l}" = ${LEVEL_MEANING[l]}`).join("; ")}.

# Rules
1. Every question must be about ${subject} and match the requested difficulty.
2. "correctAnswer" must be unambiguously correct, every entry in "wrongAnswers" must be unambiguously wrong, and "explanation" must agree with "correctAnswer".
3. The ${WRONG_ANSWER_COUNT + 1} options of a question must all be different, and no wrong answer may repeat "correctAnswer".
4. Keep the options of a question similar in length, tone and detail so the correct one does not stand out. Never use "All of the above" or "None of the above", since the options are shuffled.
5. Do not repeat a question. Question ids must be unique integers.
6. Plain text only: no HTML, no Markdown and no code fences inside the strings.
7. Write every text field in ${language}.

# Output
Return only the JSON object: no Markdown code fences, no comments and no text before or after it. It must be valid JSON (double quotes, no trailing commas).

# Example
This example uses a real question from an existing quiz and shows only the format. Write your own ${count} questions about ${subject}.
${exampleJson}`;
}
