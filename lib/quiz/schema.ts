import { z } from "zod";
import { LANGUAGES, LEVELS, QUIZ_ID_PATTERN, WRONG_ANSWER_COUNT, type Quiz } from "../types";

/**
 * Runtime schema of `data/quizzes/<id>/<language>.json`. Official quizzes and imported custom
 * quizzes are validated by the same schema, so a quiz that imports here would also be a valid
 * official quiz file.
 */

export const LIMITS = {
  title: 120,
  question: 2000,
  answer: 1000,
  explanation: 2000,
  maxQuestions: 200,
} as const;

function text(field: string, max: number) {
  return z
    .string({ error: `${field} must be a string` })
    .max(max, { error: `${field} must be at most ${max} characters` })
    .refine((value) => value.trim().length > 0, { error: `${field} must not be empty` });
}

const normalize = (value: string) => value.trim().toLowerCase();

export const quizQuestionSchema = z
  .strictObject(
    {
      id: z
        .number({ error: "id must be a number" })
        .int({ error: "id must be a whole number" })
        .positive({ error: "id must be greater than 0" }),
      level: z.enum(LEVELS, { error: `level must be one of: ${LEVELS.join(", ")}` }),
      question: text("question", LIMITS.question),
      correctAnswer: text("correctAnswer", LIMITS.answer),
      wrongAnswers: z
        .array(text("wrong answer", LIMITS.answer), { error: "wrongAnswers must be an array of strings" })
        .length(WRONG_ANSWER_COUNT, { error: `wrongAnswers must contain exactly ${WRONG_ANSWER_COUNT} answers` }),
      explanation: text("explanation", LIMITS.explanation).optional(),
    },
    { error: "each question must be an object" },
  )
  .superRefine((question, ctx) => {
    const correct = normalize(question.correctAnswer);
    const seen = new Set<string>();
    question.wrongAnswers.forEach((answer, index) => {
      const key = normalize(answer);
      if (key === correct) {
        ctx.addIssue({
          code: "custom",
          path: ["wrongAnswers", index],
          message: "a wrong answer is identical to correctAnswer",
        });
      } else if (seen.has(key)) {
        ctx.addIssue({ code: "custom", path: ["wrongAnswers", index], message: "duplicate wrong answer" });
      }
      seen.add(key);
    });
  });

export const quizSchema = z
  .strictObject(
    {
      id: z
        .string({ error: "id must be a string" })
        .regex(QUIZ_ID_PATTERN, { error: "id may only contain lowercase letters, digits and hyphens" }),
      language: z.enum(LANGUAGES, { error: `language must be one of: ${LANGUAGES.join(", ")}` }),
      title: text("title", LIMITS.title),
      questions: z
        .array(quizQuestionSchema, { error: "questions must be an array" })
        .min(1, { error: "questions must contain at least 1 question" })
        .max(LIMITS.maxQuestions, { error: `questions may contain at most ${LIMITS.maxQuestions} questions` }),
    },
    { error: "the quiz must be a JSON object" },
  )
  .superRefine((quiz, ctx) => {
    const firstIndex = new Map<number, number>();
    quiz.questions.forEach((question, index) => {
      const previous = firstIndex.get(question.id);
      if (previous === undefined) {
        firstIndex.set(question.id, index);
      } else {
        ctx.addIssue({
          code: "custom",
          path: ["questions", index, "id"],
          message: `duplicate question id ${question.id} (also used by questions[${previous}])`,
        });
      }
    });
  }) satisfies z.ZodType<Quiz>;

export interface ValidationIssue {
  /** e.g. `questions[3].wrongAnswers[1]`, or empty for the whole document. */
  path: string;
  message: string;
}

export type QuizValidationResult = { ok: true; quiz: Quiz } | { ok: false; issues: ValidationIssue[] };

export function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, key) => {
    if (typeof key === "number") return `${acc}[${key}]`;
    return acc ? `${acc}.${String(key)}` : String(key);
  }, "");
}

/** Validates an already-parsed value against the quiz schema. */
export function validateQuiz(value: unknown): QuizValidationResult {
  const result = quizSchema.safeParse(value);
  if (result.success) return { ok: true, quiz: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((issue) => {
      if (issue.code === "unrecognized_keys") {
        return {
          path: formatPath(issue.path),
          message: `unknown field${issue.keys.length > 1 ? "s" : ""} ${issue.keys.map((k) => `"${k}"`).join(", ")} (not part of the quiz format)`,
        };
      }
      return { path: formatPath(issue.path), message: issue.message };
    }),
  };
}

function lineAndColumn(source: string, offset: number): { line: number; column: number } {
  const lines = source.slice(0, offset).split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

/**
 * Offset of the first JSON syntax error, or -1. `JSON.parse` messages do not always include a
 * position, so this small scanner finds it for the error message.
 */
export function jsonErrorOffset(source: string): number {
  let i = 0;
  const ws = () => {
    while (i < source.length && " \t\n\r".includes(source[i])) i++;
  };
  const fail = () => {
    throw i;
  };
  const literal = (word: string) => {
    if (source.startsWith(word, i)) i += word.length;
    else fail();
  };
  const string = () => {
    i++; // opening quote
    while (i < source.length && source[i] !== '"') {
      const ch = source.charCodeAt(i);
      if (ch < 0x20) fail();
      if (source[i] === "\\") {
        i++;
        if (source[i] === "u") {
          if (!/^[0-9a-fA-F]{4}$/.test(source.slice(i + 1, i + 5))) fail();
          i += 4;
        } else if (!'"\\/bfnrt'.includes(source[i] ?? "")) fail();
      }
      i++;
    }
    if (i >= source.length) fail();
    i++;
  };
  const number = () => {
    const match = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(source.slice(i));
    if (!match) fail();
    i += match![0].length;
  };
  const value = (): void => {
    ws();
    const ch = source[i];
    if (ch === "{") {
      i++;
      ws();
      if (source[i] === "}") return void i++;
      for (;;) {
        ws();
        if (source[i] !== '"') fail();
        string();
        ws();
        if (source[i] !== ":") fail();
        i++;
        value();
        ws();
        if (source[i] === ",") i++;
        else if (source[i] === "}") return void i++;
        else fail();
      }
    }
    if (ch === "[") {
      i++;
      ws();
      if (source[i] === "]") return void i++;
      for (;;) {
        value();
        ws();
        if (source[i] === ",") i++;
        else if (source[i] === "]") return void i++;
        else fail();
      }
    }
    if (ch === '"') return string();
    if (ch === "t") return literal("true");
    if (ch === "f") return literal("false");
    if (ch === "n") return literal("null");
    return number();
  };
  try {
    value();
    ws();
    return i < source.length ? i : -1;
  } catch (offset) {
    return typeof offset === "number" ? Math.min(offset, source.length) : -1;
  }
}

/**
 * Parses and validates pasted JSON. The input is only ever passed to `JSON.parse`, never
 * evaluated, and is not modified: errors point at what to fix instead.
 */
export function validateQuizJson(source: string): QuizValidationResult {
  const trimmed = source.trim();
  if (!trimmed) return { ok: false, issues: [{ path: "", message: "Paste the quiz JSON first." }] };

  if (trimmed.startsWith("```")) {
    return {
      ok: false,
      issues: [
        {
          path: "",
          message:
            "The text is wrapped in a Markdown code fence (```). Remove the fence lines so only the JSON object remains.",
        },
      ],
    };
  }

  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const offset = jsonErrorOffset(trimmed);
    const where = offset >= 0 ? lineAndColumn(trimmed, offset) : null;
    return {
      ok: false,
      issues: [
        {
          path: "",
          message: where
            ? `Invalid JSON at line ${where.line}, column ${where.column}: ${message}`
            : `Invalid JSON: ${message}`,
        },
      ],
    };
  }

  return validateQuiz(value);
}
