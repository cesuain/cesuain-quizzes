import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { Player, createTestDb, expectDbError, totalXp, type TestDb } from "./harness";

let t: TestDb;
let alice: Player;
let bob: Player;
let aliceAttempt: string;

beforeAll(async () => {
  t = await createTestDb();
  alice = new Player(t, await t.createUser("alice@example.test"));
  bob = new Player(t, await t.createUser("bob@example.test"));
  aliceAttempt = (await alice.play("mini")).attemptId;
});

const OWN_TABLES = ["quiz_attempts", "attempt_questions", "question_responses", "xp_ledger", "user_achievements"];

describe("data isolation between users", () => {
  it.each(OWN_TABLES)("bob cannot read alice's %s", async (table) => {
    const own = await alice.run(() => t.db.query(`select * from public.${table}`));
    expect(own.rows.length).toBeGreaterThan(0);
    const other = await bob.run(() => t.db.query(`select * from public.${table}`));
    expect(other.rows).toHaveLength(0);
  });

  it("bob cannot read alice's profile", async () => {
    const { rows } = await bob.run(() => t.db.query("select id from public.profiles"));
    expect(rows).toEqual([{ id: bob.userId }]);
  });

  it("bob cannot open, answer, reveal or abandon alice's attempt", async () => {
    const active = await alice.start("mini");
    const { questions } = await alice.attempt(active);
    const option = questions[0].options[0].id;
    expect(await expectDbError(bob.attempt(aliceAttempt))).toContain("attempt_not_found");
    expect(await expectDbError(bob.submit(active, questions[0].question_id, option))).toContain("attempt_not_found");
    expect(await expectDbError(bob.reveal(active, questions[0].question_id))).toContain("attempt_not_found");
    expect(
      await expectDbError(bob.run(() => t.db.query("select public.abandon_attempt($1)", [active]))),
    ).toContain("attempt_not_found");
    expect((await alice.attempt(active)).attempt).toMatchObject({ status: "in_progress", questions_answered: 0 });
  });

  it("stats and achievements only ever describe the caller", async () => {
    const { rows } = await bob.run(() => t.db.query<{ data: { total_xp: number } }>("select public.my_stats() as data"));
    expect(rows[0].data.total_xp).toBe(0);
    const unlocked = await bob.run(() =>
      t.db.query("select slug from public.my_achievements() where unlocked_at is not null"),
    );
    expect(unlocked.rows).toHaveLength(0);
  });

  it("internal functions that take a user id are not callable", async () => {
    for (const sql of [
      `select * from private.achievement_progress('${alice.userId}')`,
      `select private.evaluate_achievements('${bob.userId}', '{}'::jsonb)`,
      `select private.try_complete_attempt('${aliceAttempt}')`,
      "select private.xp_for_submission(1, true)",
    ]) {
      expect(await expectDbError(bob.run(() => t.db.query(sql)))).toContain("permission denied");
    }
  });
});

describe("XP, correctness and unlocks cannot be forged", () => {
  it.each([
    ["xp_ledger", "insert into public.xp_ledger (user_id, amount, award_type, attempt_id, event, idempotency_key) values ($1, 1000, 'completion_bonus', $2, 'attempt_completed', 'forged')"],
    ["user_achievements", "insert into public.user_achievements (user_id, achievement_id) select $1, id from public.achievements limit 1"],
    ["quiz_attempts", "insert into public.quiz_attempts (user_id, quiz_id, language, level_filter, total_questions, status, completed_at) values ($1, 'mini', 'en', 'all', 1, 'completed', now())"],
    ["question_responses", "insert into public.question_responses (attempt_id, user_id, question_id, is_correct, submission_number, client_event_id) select $2, $1, question_id, true, 9, gen_random_uuid() from public.attempt_questions limit 1"],
  ])("users cannot insert into %s", async (_table, sql) => {
    const params = sql.includes("$2") ? [alice.userId, aliceAttempt] : [alice.userId];
    expect(await expectDbError(alice.run(() => t.db.query(sql, params)))).toContain("permission denied");
  });

  it.each([
    "update public.xp_ledger set amount = 100000",
    "delete from public.xp_ledger",
    "update public.quiz_attempts set xp_earned = 100000, accuracy = 100",
    "update public.question_responses set is_correct = true",
    "update public.attempt_questions set outcome = 'correct'",
    "delete from public.user_achievements",
    "update public.user_achievements set unlocked_at = now() - interval '1 year'",
  ])("users cannot modify their own records: %s", async (sql) => {
    const before = await totalXp(t, alice.userId);
    expect(await expectDbError(alice.run(() => t.db.query(sql)))).toContain("permission denied");
    expect(await totalXp(t, alice.userId)).toBe(before);
  });

  it("submit_answer accepts no correctness or XP argument", async () => {
    const error = await expectDbError(
      alice.run(() =>
        t.db.query("select public.submit_answer($1, $2, $3, $4, true, 50)", [
          aliceAttempt,
          randomUUID(),
          randomUUID(),
          randomUUID(),
        ]),
      ),
    );
    expect(error).toMatch(/does not exist/);
  });

  it("users may rename themselves and nothing else", async () => {
    await alice.run(() => t.db.query("update public.profiles set display_name = 'Alice'"));
    const { rows } = await t.db.query("select display_name from public.profiles where id = $1", [alice.userId]);
    expect(rows).toEqual([{ display_name: "Alice" }]);
    expect(
      await expectDbError(alice.run(() => t.db.query("update public.profiles set created_at = now()"))),
    ).toContain("permission denied");
    await bob.run(() => t.db.query("update public.profiles set display_name = 'Hacked' where id = $1", [alice.userId]));
    const after = await t.db.query("select display_name from public.profiles where id = $1", [alice.userId]);
    expect(after.rows).toEqual([{ display_name: "Alice" }]);
  });
});

describe("answer keys", () => {
  it("questions and answer options are not directly readable", async () => {
    expect(await expectDbError(alice.run(() => t.db.query("select * from public.answer_options")))).toContain(
      "permission denied",
    );
    expect(await expectDbError(alice.run(() => t.db.query("select is_correct from public.answer_options")))).toContain(
      "permission denied",
    );
    expect(await expectDbError(alice.run(() => t.db.query("select * from public.questions")))).toContain(
      "permission denied",
    );
  });

  it("pending questions expose no correct option and no explanation", async () => {
    const attemptId = await alice.start("mini");
    const { questions } = await alice.attempt(attemptId);
    for (const q of questions) {
      expect(q.correct_option_id).toBeNull();
      expect(q.explanation).toBeNull();
      for (const option of q.options) expect(Object.keys(option).sort()).toEqual(["body", "id"]);
    }
    // A wrong answer does not reveal the key either.
    const wrong = await alice.answerWrong(attemptId, questions[0]);
    expect(wrong.question.correct_option_id).toBeNull();
    // Revealing (after a wrong answer) does.
    const revealed = await alice.reveal(attemptId, questions[0].question_id);
    expect(revealed.question.correct_option_id).toBe(await alice.correctOption(questions[0].question_id));
    expect(revealed.question.explanation).toBe(questions[0].prompt.replace(/^Question (\d+)\?$/, "Because $1."));
  });

  it("revealing requires at least one answer first", async () => {
    const attemptId = await alice.start("mini");
    const { questions } = await alice.attempt(attemptId);
    expect(await expectDbError(alice.reveal(attemptId, questions[0].question_id))).toContain("answer_first");
  });
});

describe("official content", () => {
  it.each([
    "insert into public.quizzes (id) values ('imported')",
    "update public.quizzes set is_published = false",
    "insert into public.quiz_localizations (quiz_id, language, title) values ('mini', 'en', 'x')",
    "update public.quiz_localizations set title = 'Overwritten'",
    "delete from public.questions",
    "update public.answer_options set is_correct = true",
    "insert into public.achievements (slug, name, description, icon, category, criteria_type, criteria_config) values ('x', 'x', 'x', 'zap', 'streak', 'correct_streak', '{\"count\": 1}')",
  ])("users cannot change official definitions: %s", async (sql) => {
    expect(await expectDbError(alice.run(() => t.db.query(sql)))).toContain("permission denied");
  });

  it("unpublished quizzes are hidden and cannot be started", async () => {
    await t.db.query("update public.quizzes set is_published = false where id = 'typescript'");
    const { rows } = await alice.run(() => t.db.query<{ id: string }>("select id from public.quizzes"));
    expect(rows.map((r) => r.id)).not.toContain("typescript");
    expect(await expectDbError(alice.start("typescript"))).toContain("quiz_not_found");
    await t.db.query("update public.quizzes set is_published = true where id = 'typescript'");
  });

  it("signed-out visitors get nothing", async () => {
    expect(await expectDbError(t.asAnon(() => t.db.query("select * from public.quizzes")))).toContain(
      "permission denied",
    );
    expect(await expectDbError(t.asAnon(() => t.db.query("select public.quiz_catalog()")))).toContain(
      "permission denied",
    );
    expect(
      await expectDbError(t.asAnon(() => t.db.query("select public.start_attempt('mini', 'en', 'all', 0, 0)"))),
    ).toContain("permission denied");
  });

  it("the client API refuses to run without a signed-in user", async () => {
    // Even if execute were granted, the functions check auth.uid() themselves.
    expect(await expectDbError(t.db.query("select public.quiz_catalog()"))).toContain("not_authenticated");
  });
});
