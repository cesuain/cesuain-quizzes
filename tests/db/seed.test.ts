import { beforeAll, describe, expect, it } from "vitest";
import achievementsJson from "../../data/achievements.json";
import { parseAchievementCatalog } from "../../lib/achievements/catalog";
import { readAllOfficialQuizzes } from "../../lib/quiz/official-content";
import { buildSeedSql } from "../../lib/seed/build-seed";
import { Player, createTestDb, makeQuiz, type TestDb } from "./harness";

let t: TestDb;
let seedSql: string;

beforeAll(async () => {
  seedSql = buildSeedSql(await readAllOfficialQuizzes(), parseAchievementCatalog(achievementsJson));
  t = await createTestDb({ seedSql });
});

async function counts() {
  const { rows } = await t.db.query<Record<string, number>>(
    `select (select count(*)::int from public.quizzes where is_published) as quizzes,
            (select count(*)::int from public.questions where is_active) as questions,
            (select count(*)::int from public.answer_options) as options,
            (select count(*)::int from public.answer_options where is_correct) as correct,
            (select count(*)::int from public.achievements where is_active) as achievements`,
  );
  return rows[0];
}

describe("seed generated from data/", () => {
  it("loads every official quiz with one correct option per question", async () => {
    expect(await counts()).toEqual({ quizzes: 8, questions: 1600, options: 6400, correct: 1600, achievements: 18 });
  });

  it("serves the real catalog to signed-in users", async () => {
    const p = new Player(t, await t.createUser());
    const { rows } = await p.run(() =>
      t.db.query<{ data: { id: string; titles: Record<string, string>; counts: Record<string, number> }[] }>(
        "select public.quiz_catalog() as data",
      ),
    );
    const react = rows[0].data.find((q) => q.id === "react")!;
    expect(react.titles).toEqual({ en: "React", "pt-br": "React" });
    expect(Object.values(react.counts).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("is idempotent and keeps option ids, so existing attempts stay valid", async () => {
    const p = new Player(t, await t.createUser());
    const attemptId = await p.start("react", { count: 10 });
    const before = await t.db.query("select id from public.answer_options order by id");
    await t.db.exec(seedSql);
    const after = await t.db.query("select id from public.answer_options order by id");
    expect(after.rows).toEqual(before.rows);
    expect(await counts()).toMatchObject({ questions: 1600, options: 6400 });
    expect((await p.attempt(attemptId)).questions).toHaveLength(10);
  });

  it("deactivates removed questions and unpublishes removed quizzes without deleting history", async () => {
    const p = new Player(t, await t.createUser());
    const { attemptId } = await p.play("react", () => 0, { count: 3 });
    const shrunk = await readAllOfficialQuizzes();
    const withoutWonderlic = shrunk.filter((group) => group[0].id !== "wonderlic");
    for (const quiz of withoutWonderlic.find((g) => g[0].id === "react")!) quiz.questions = quiz.questions.slice(0, 10);
    await t.db.exec(buildSeedSql([...withoutWonderlic, makeQuiz("new-quiz", "New", 3)], parseAchievementCatalog(achievementsJson)));

    const { rows } = await t.db.query<{ id: string; is_published: boolean }>(
      "select id, is_published from public.quizzes where id in ('wonderlic', 'new-quiz') order by id",
    );
    expect(rows).toEqual([
      { id: "new-quiz", is_published: true },
      { id: "wonderlic", is_published: false },
    ]);
    const active = await t.db.query<{ n: number }>(
      "select count(*)::int as n from public.questions where quiz_id = 'react' and language = 'en' and is_active",
    );
    expect(active.rows[0].n).toBe(10);
    expect((await p.attempt(attemptId)).attempt).toMatchObject({ status: "completed" });
  });
});
