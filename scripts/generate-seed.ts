import { promises as fs } from "node:fs";
import path from "node:path";
import { parseAchievementCatalog } from "../lib/achievements/catalog";
import { readAllOfficialQuizzes } from "../lib/quiz/official-content";
import { buildSeedSql } from "../lib/seed/build-seed";

// Validates data/quizzes and data/achievements.json, then writes supabase/seed.sql.
async function main() {
  const quizzes = await readAllOfficialQuizzes();
  const achievements = parseAchievementCatalog(
    JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "achievements.json"), "utf8")),
  );
  const target = path.join(process.cwd(), "supabase", "seed.sql");
  await fs.writeFile(target, buildSeedSql(quizzes, achievements));
  const questionCount = quizzes.flat().reduce((sum, q) => sum + q.questions.length, 0);
  console.log(
    `Wrote ${path.relative(process.cwd(), target)}: ${quizzes.length} quizzes, ${questionCount} questions, ${achievements.length} achievements.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
