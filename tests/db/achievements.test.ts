import { beforeAll, describe, expect, it } from "vitest";
import { Player, createTestDb, unlockedSlugs, type TestDb } from "./harness";

let t: TestDb;

beforeAll(async () => {
  t = await createTestDb();
});

async function newPlayer() {
  return new Player(t, await t.createUser());
}

async function progress(p: Player) {
  const { rows } = await p.run(() =>
    t.db.query<{ slug: string; current_value: string; target_value: string; unlocked_at: string | null }>(
      "select slug, current_value::text, target_value::text, unlocked_at from public.my_achievements()",
    ),
  );
  return Object.fromEntries(
    rows.map((r) => [r.slug, { current: Number(r.current_value), target: Number(r.target_value), unlocked: !!r.unlocked_at }]),
  );
}

async function stats(p: Player) {
  const { rows } = await p.run(() =>
    t.db.query<{ data: { current_streak: number; best_streak: number } }>("select public.my_stats() as data"),
  );
  return rows[0].data;
}

describe("quiz completion", () => {
  it("unlocks First Steps on the first official completion, and only once", async () => {
    const p = await newPlayer();
    const first = await p.play("mini");
    expect(first.unlocked).toContain("first-steps");
    const second = await p.play("mini");
    expect(second.unlocked).not.toContain("first-steps");
    const { rows } = await t.db.query(
      `select 1 from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id
       where ua.user_id = $1 and a.slug = 'first-steps'`,
      [p.userId],
    );
    expect(rows).toHaveLength(1);
  });

  it("shows completion progress before unlocking Quiz Explorer", async () => {
    const p = await newPlayer();
    for (let i = 0; i < 3; i++) await p.play("mini");
    expect((await progress(p))["quiz-explorer"]).toEqual({ current: 3, target: 5, unlocked: false });
    await p.play("mini");
    const fifth = await p.play("mini");
    expect(fifth.unlocked).toContain("quiz-explorer");
  });

  it("does not count abandoned or in-progress attempts", async () => {
    const p = await newPlayer();
    const abandoned = await p.start("mini");
    await p.run(() => t.db.query("select public.abandon_attempt($1)", [abandoned]));
    await p.start("mini");
    expect((await progress(p))["first-steps"]).toEqual({ current: 0, target: 1, unlocked: false });
  });
});

describe("quiz-specific achievements", () => {
  it("uses the stable quiz id, so renaming the quiz does not matter", async () => {
    const p = await newPlayer();
    const other = await p.play("javascript");
    expect(other.unlocked).not.toContain("react-specialist");

    await t.db.query("update public.quiz_localizations set title = 'Renamed React' where quiz_id = 'react'");
    const react = await p.play("react");
    expect(react.unlocked).toContain("react-specialist");
    await t.db.query("update public.quiz_localizations set title = 'React' where quiz_id = 'react' and language = 'en'");
  });

  it("Level Complete requires a basic-level completion of every configured quiz", async () => {
    const p = await newPlayer();
    await p.play("javascript", () => 0, { level: "basic" });
    await p.play("typescript", () => 0, { level: "all" }); // not filtered to the level: does not count
    expect((await progress(p))["level-complete-foundations"]).toEqual({ current: 1, target: 3, unlocked: false });
    await p.play("typescript", () => 0, { level: "basic" });
    const last = await p.play("react", () => 0, { level: "basic" });
    expect(last.unlocked).toContain("level-complete-foundations");
  });
});

describe("question milestones", () => {
  it("unlocks Curious Mind at exactly 5 correct answers", async () => {
    const p = await newPlayer();
    const attemptId = await p.start("big", { count: 10 });
    const { questions } = await p.attempt(attemptId);
    for (const q of questions.slice(0, 4)) {
      expect((await p.answerCorrectly(attemptId, q)).unlocked_achievements.map((a) => a.slug)).not.toContain(
        "curious-mind",
      );
    }
    const fifth = await p.answerCorrectly(attemptId, questions[4]);
    expect(fifth.unlocked_achievements.map((a) => a.slug)).toContain("curious-mind");
  });

  it("counts correct answers that needed a retry, but not toward first-try achievements", async () => {
    const p = await newPlayer();
    // 10 questions, the first one answered on the second try.
    const { unlocked } = await p.play("big", (i) => (i === 0 ? 1 : 0), { count: 10 });
    expect(unlocked).toContain("knowledge-seeker");
    expect(unlocked).not.toContain("first-try-champion");
    const current = await progress(p);
    expect(current["knowledge-seeker"]).toMatchObject({ current: 10, unlocked: true });
    expect(current["first-try-champion"]).toEqual({ current: 9, target: 10, unlocked: false });
  });
});

describe("correct-answer streaks", () => {
  it("advances on correct answers and resets on a wrong one, even if the retry is correct", async () => {
    const p = await newPlayer();
    const attemptId = await p.start("big", { count: 12 });
    const { questions } = await p.attempt(attemptId);
    for (const q of questions.slice(0, 4)) await p.answerCorrectly(attemptId, q);
    expect(await stats(p)).toMatchObject({ current_streak: 4, best_streak: 4 });

    await p.answerWrong(attemptId, questions[4]);
    expect(await stats(p)).toMatchObject({ current_streak: 0, best_streak: 4 });
    await p.answerCorrectly(attemptId, questions[4]);
    expect(await stats(p)).toMatchObject({ current_streak: 1, best_streak: 4 });

    for (const q of questions.slice(5, 8)) await p.answerCorrectly(attemptId, q);
    expect((await progress(p))["sharp-mind"]).toEqual({ current: 4, target: 5, unlocked: false });
    const fifth = await p.answerCorrectly(attemptId, questions[8]);
    expect(fifth.unlocked_achievements.map((a) => a.slug)).toContain("sharp-mind");
    expect(await stats(p)).toMatchObject({ current_streak: 5, best_streak: 5 });
  });

  it("resets on a timeout", async () => {
    const p = await newPlayer();
    const attemptId = await p.start("big", { count: 5 });
    const { questions } = await p.attempt(attemptId);
    await p.answerCorrectly(attemptId, questions[0]);
    await p.submit(attemptId, questions[1].question_id, null);
    expect(await stats(p)).toMatchObject({ current_streak: 0, best_streak: 1 });
  });

  it("continues across attempts", async () => {
    const p = await newPlayer();
    await p.play("big", () => 0, { count: 3 });
    const { unlocked } = await p.play("big", () => 0, { count: 3 });
    expect(unlocked).toContain("sharp-mind");
    expect(await stats(p)).toMatchObject({ best_streak: 6 });
  });
});

describe("accuracy achievements", () => {
  it("respect their minimum question counts", async () => {
    const p = await newPlayer();
    const mini = await p.play("mini"); // 5 questions, 100%
    expect(mini.unlocked).toContain("full-marks");
    expect(mini.unlocked).not.toContain("precision");
    expect(mini.unlocked).not.toContain("getting-the-hang-of-it");

    const react = await p.play("react", (i) => (i < 2 ? 1 : 0)); // 12 questions, 10 first-try = 83.33%
    expect(react.unlocked).toContain("getting-the-hang-of-it");
    expect(react.unlocked).not.toContain("precision");
    expect((await progress(p)).precision).toEqual({ current: 83.33, target: 100, unlocked: false });

    const perfect = await p.play("react");
    expect(perfect.unlocked).toContain("precision");
  });
});

describe("integrity", () => {
  it("re-evaluating the same state never creates duplicate unlocks", async () => {
    const p = await newPlayer();
    await p.play("mini");
    const before = await unlockedSlugs(t, p.userId);
    const { rows } = await t.db.query<{ unlocked: unknown[] }>(
      "select private.evaluate_achievements($1, '{}'::jsonb) as unlocked",
      [p.userId],
    );
    expect(rows[0].unlocked).toEqual([]);
    expect(await unlockedSlugs(t, p.userId)).toEqual(before);
  });

  it("progress matches the persisted official records", async () => {
    const p = await newPlayer();
    await p.play("big", (i) => (i % 3 === 0 ? 1 : 0), { count: 9 });
    const attemptId = await p.start("mini");
    const { questions } = await p.attempt(attemptId);
    await p.answerCorrectly(attemptId, questions[0]);

    const { rows } = await t.db.query<{ correct: number; first_try: number; completed: number }>(
      `select
         (select count(*)::int from public.question_responses where user_id = $1 and is_correct) as correct,
         (select count(*)::int from public.question_responses where user_id = $1 and is_correct and submission_number = 1) as first_try,
         (select count(*)::int from public.quiz_attempts where user_id = $1 and status = 'completed') as completed`,
      [p.userId],
    );
    const current = await progress(p);
    expect(current["knowledge-seeker"].current).toBe(rows[0].correct);
    expect(rows[0].correct).toBe(10);
    expect(current["first-try-champion"].current).toBe(rows[0].first_try);
    expect(rows[0].first_try).toBe(7);
    expect(current["quiz-explorer"].current).toBe(rows[0].completed);
  });

  it("records the triggering event on the unlock", async () => {
    const p = await newPlayer();
    const { attemptId } = await p.play("mini");
    const { rows } = await t.db.query<{ metadata: { event: string; attempt_id: string } }>(
      `select ua.metadata from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id
       where ua.user_id = $1 and a.slug = 'first-steps'`,
      [p.userId],
    );
    expect(rows[0].metadata).toMatchObject({ event: "attempt_completed", attempt_id: attemptId });
    const data = await p.attempt(attemptId);
    expect(data.unlocked_achievements.map((a) => a.slug)).toContain("first-steps");
  });

  it("ignores inactive achievements", async () => {
    await t.db.query("update public.achievements set is_active = false where slug = 'quiz-master'");
    const p = await newPlayer();
    expect(await progress(p)).not.toHaveProperty("quiz-master");
    await t.db.query("update public.achievements set is_active = true where slug = 'quiz-master'");
  });

  it("rejects malformed criteria config", async () => {
    const error = await t.db
      .query(
        `insert into public.achievements (slug, name, description, icon, category, criteria_type, criteria_config)
         values ('broken', 'Broken', 'x', 'zap', 'streak', 'correct_streak', '{"count": "ten"}')`,
      )
      .then(
        () => "",
        (e: Error) => e.message,
      );
    expect(error).toContain("check constraint");
  });
});
