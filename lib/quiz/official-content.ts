import { promises as fs } from "node:fs";
import path from "node:path";
import { LANGUAGES, QUIZ_ID_PATTERN, type Language, type Quiz } from "../types";
import { validateQuiz } from "./schema";

/**
 * Reads the official quiz files. They are the source of truth for official content and are
 * loaded into Supabase by `npm run db:seed` (see lib/seed/build-seed.ts). The app reads
 * official questions from the database at runtime, never from these files.
 */

export const QUIZZES_DIR = path.join(process.cwd(), "data", "quizzes");

export class OfficialQuizError extends Error {}

export async function readOfficialQuiz(id: string, language: Language, dir = QUIZZES_DIR): Promise<Quiz> {
  const file = path.join(dir, id, `${language}.json`);
  const raw = await fs.readFile(file, "utf8");
  const result = validateQuiz(JSON.parse(raw));
  if (!result.ok) {
    const details = result.issues.map((issue) => `  ${issue.path || "(root)"}: ${issue.message}`).join("\n");
    throw new OfficialQuizError(`${path.relative(process.cwd(), file)} is invalid:\n${details}`);
  }
  if (result.quiz.id !== id || result.quiz.language !== language) {
    throw new OfficialQuizError(
      `${path.relative(process.cwd(), file)} declares id "${result.quiz.id}" / language "${result.quiz.language}", expected "${id}" / "${language}"`,
    );
  }
  return result.quiz;
}

/** Every quiz folder, with one validated file per supported language. */
export async function readAllOfficialQuizzes(dir = QUIZZES_DIR): Promise<Quiz[][]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const ids = entries
    .filter((e) => e.isDirectory() && QUIZ_ID_PATTERN.test(e.name))
    .map((e) => e.name)
    .sort();
  return Promise.all(ids.map((id) => Promise.all(LANGUAGES.map((language) => readOfficialQuiz(id, language, dir)))));
}
