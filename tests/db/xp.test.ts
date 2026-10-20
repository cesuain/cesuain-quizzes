import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { COMPLETION_BONUS_XP, xpForSubmission } from "../../lib/domain/scoring";
import { Player, createTestDb, expectDbError, totalXp, type TestDb } from "./harness";

let t: TestDb;

beforeAll(async () => {
  t = await createTestDb();
});

async function newPlayer() {
  return new Player(t, await t.createUser());
}

async function ledger(userId: string) {
  const { rows } = await t.db.query<{ amount: number; award_type: string; idempotency_key: string }>(
    "select amount, award_type, idempotency_key from public.xp_ledger where user_id = $1 order by created_at, amount",
    [userId],
  );
  return rows;
}

describe("question XP", () => {
  it("awards 50 XP for a correct first answer", async () => {
    const p = await newPlayer();
    const attemptId = await p.start("mini");
    const { questions } = await p.attempt(attemptId);
    const result = await p.answerCorrectly(attemptId, questions[0]);
    expect(result).toMatchObject({ is_correct: true, submission_number: 1, xp_awarded: 50 });
    expect(await totalXp(t, p.userId)).toBe(50);
  });

  it("awards 25 XP for a correct second answer and nothing for the wrong one", async () => {
    const p = await newPlayer();
    const attemptId = await p.start("mini");
    const { questions } = await p.attempt(attemptId);
    const wrong = await p.answerWrong(attemptId, questions[0]);
    expect(wrong).toMatchObject({ is_correct: false, submission_number: 1, xp_awarded: 0 });
    expect(wrong.question.outcome).toBe("pending");
    const right = await p.answerCorrectly(attemptId, questions[0]);
    expect(right).toMatchObject({ is_correct: true, submission_number: 2, xp_awarded: 25 });
    expect(await totalXp(t, p.userId)).toBe(25);
  });

  it("awards nothing for a correct third or fourth answer", async () => {
    const p = await newPlayer();
    const attemptId = await p.start("mini");
    const { questions } = await p.attempt(attemptId);
    await p.answerWrong(attemptId, questions[0], 0);
    await p.answerWrong(attemptId, questions[0], 1);
    const third = await p.answerCorrectly(attemptId, questions[0]);
    expect(third).toMatchObject({ is_correct: true, submission_number: 3, xp_awarded: 0 });

    await p.answerWrong(attemptId, questions[1], 0);
    await p.answerWrong(attemptId, questions[1], 1);
    await p.answerWrong(attemptId, questions[1], 2);
    const fourth = await p.answerCorrectly(attemptId, questions[1]);
    expect(fourth).toMatchObject({ submission_number: 4, xp_awarded: 0 });
    expect(await totalXp(t, p.userId)).toBe(0);
  });

  it("treats a timeout as a wrong answer that resolves the question", async () => {
    const p = await newPlayer();
    const attemptId = await p.start("mini");
    const { questions } = await p.attempt(attemptId);
    const result = await p.submit(attemptId, questions[0].question_id, null);
    expect(result).toMatchObject({ is_correct: false, xp_awarded: 0 });
    expect(result.question.outcome).toBe("timed_out");
    expect(result.question.correct_option_id).toBe(await p.correctOption(questions[0].question_id));
  });

  it("never awards a question twice: answering again after a correct answer is rejected", async () => {
    const p = await newPlayer();
    const attemptId = await p.start("mini");
    const { questions } = await p.attempt(attemptId);
    await p.answerCorrectly(attemptId, questions[0]);
    expect(await expectDbError(p.answerCorrectly(attemptId, questions[0]))).toContain("question_resolved");
    expect(await expectDbError(p.answerWrong(attemptId, questions[0]))).toContain("question_resolved");
    expect(await totalXp(t, p.userId)).toBe(50);
  });

  it("rejects submitting the same wrong option twice", async () => {
    const p = await newPlayer();
    const attemptId = await p.start("mini");
    const { questions } = await p.attempt(attemptId);
    await p.answerWrong(attemptId, questions[0], 0);
    expect(await expectDbError(p.answerWrong(attemptId, questions[0], 0))).toContain("option_already_tried");
    // The rejected retry did not consume a submission: the next correct answer is the 2nd one.
    expect((await p.answerCorrectly(attemptId, questions[0])).xp_awarded).toBe(25);
  });

  it("rejects options that belong to another question", async () => {
    const p = await newPlayer();
    const attemptId = await p.start("mini");
    const { questions } = await p.attempt(attemptId);
    const foreign = await p.correctOption(questions[1].question_id);
    expect(await expectDbError(p.submit(attemptId, questions[0].question_id, foreign))).toContain("invalid_option");
  });

  it("matches the display-only mirror in lib/domain/scoring.ts", async () => {
    for (const submission of [1, 2, 3, 4, 10]) {
      for (const correct of [true, false]) {
        const { rows } = await t.db.query<{ xp: number }>("select private.xp_for_submission($1, $2) as xp", [
          submission,
          correct,
        ]);
        expect(rows[0].xp).toBe(xpForSubmission("official", submission, correct));
      }
    }
    const { rows } = await t.db.query<{ bonus: number }>("select private.completion_bonus() as bonus");
    expect(rows[0].bonus).toBe(COMPLETION_BONUS_XP);
  });
});

describe("idempotency", () => {
  it("replaying the same client event returns the original result without new awards", async () => {
    const p = await newPlayer();
    const attemptId = await p.start("mini");
    const { questions } = await p.attempt(attemptId);
    const eventId = randomUUID();
    const correct = await p.correctOption(questions[0].question_id);

    const first = await p.submit(attemptId, questions[0].question_id, correct, eventId);
    const replay = await p.submit(attemptId, questions[0].question_id, correct, eventId);
    const replayAgain = await p.submit(attemptId, questions[0].question_id, correct, eventId);

    expect(first.replayed).toBe(false);
    expect(replay).toMatchObject({ replayed: true, response_id: first.response_id, xp_awarded: 50 });
    expect(replayAgain.unlocked_achievements).toEqual([]);
    expect(await ledger(p.userId)).toHaveLength(1);
    const { rows } = await t.db.query("select 1 from public.question_responses where attempt_id = $1", [attemptId]);
    expect(rows).toHaveLength(1);
  });

  it("rejects reusing an event id for a different answer", async () => {
    const p = await newPlayer();
    const attemptId = await p.start("mini");
    const { questions } = await p.attempt(attemptId);
    const eventId = randomUUID();
    await p.answerWrong(attemptId, questions[0], 0).then(() => undefined);
    const wrongs = await p.wrongOptions(questions[0]);
    await p.submit(attemptId, questions[0].question_id, wrongs[1], eventId);
    expect(await expectDbError(p.submit(attemptId, questions[0].question_id, wrongs[2], eventId))).toContain(
      "idempotency_conflict",
    );
  });

  it("the ledger refuses a second award with the same idempotency key", async () => {
    const p = await newPlayer();
    const { attemptId } = await p.play("mini");
    const error = await expectDbError(
      t.db.query(
        `insert into public.xp_ledger (user_id, amount, award_type, attempt_id, event, idempotency_key)
         values ($1, 500, 'completion_bonus', $2, 'attempt_completed', $3)`,
        [p.userId, attemptId, `completion:${attemptId}`],
      ),
    );
    expect(error).toMatch(/duplicate key|unique/);
  });
});

describe("completion bonus", () => {
  it("awards exactly 500 XP once the last question is resolved", async () => {
    const p = await newPlayer();
    const { attemptId, last } = await p.play("mini");
    expect(last.attempt_completed).toBe(true);
    expect(last.attempt).toMatchObject({ status: "completed", completion_bonus: 500, xp_earned: 250 });
    expect(await totalXp(t, p.userId)).toBe(5 * 50 + 500);
    const bonuses = (await ledger(p.userId)).filter((row) => row.award_type === "completion_bonus");
    expect(bonuses).toEqual([{ amount: 500, award_type: "completion_bonus", idempotency_key: `completion:${attemptId}` }]);
  });

  it("is awarded when questions were revealed or timed out, without question XP for them", async () => {
    const p = await newPlayer();
    const { last } = await p.play("mini", (i) => (i === 0 ? Infinity : i === 1 ? 1 : 0));
    expect(last.attempt).toMatchObject({ status: "completed", completion_bonus: 500 });
    // q0 revealed (0), q1 second try (25), q2..q4 first try (150)
    expect(await totalXp(t, p.userId)).toBe(25 + 150 + 500);
  });

  it("is not awarded to an incomplete attempt", async () => {
    const p = await newPlayer();
    const attemptId = await p.start("mini");
    const { questions } = await p.attempt(attemptId);
    for (const q of questions.slice(0, 4)) await p.answerCorrectly(attemptId, q);
    const data = await p.attempt(attemptId);
    expect(data.attempt).toMatchObject({ status: "in_progress", completion_bonus: 0 });
    expect(await totalXp(t, p.userId)).toBe(200);
  });

  it("is not awarded to an abandoned attempt, and an abandoned attempt accepts no answers", async () => {
    const p = await newPlayer();
    const attemptId = await p.start("mini");
    const { questions } = await p.attempt(attemptId);
    await p.answerCorrectly(attemptId, questions[0]);
    await p.run(() => t.db.query("select public.abandon_attempt($1)", [attemptId]));
    expect(await expectDbError(p.answerCorrectly(attemptId, questions[1]))).toContain("attempt_closed");
    expect(await totalXp(t, p.userId)).toBe(50);
  });

  it("cannot be earned twice by retrying the final answer or revealing again", async () => {
    const p = await newPlayer();
    const attemptId = await p.start("mini");
    const { questions } = await p.attempt(attemptId);
    for (const q of questions.slice(0, 4)) await p.answerCorrectly(attemptId, q);
    const lastQuestion = questions[4];
    await p.answerWrong(attemptId, lastQuestion);
    const eventId = randomUUID();
    const correct = await p.correctOption(lastQuestion.question_id);
    const done = await p.submit(attemptId, lastQuestion.question_id, correct, eventId);
    const replay = await p.submit(attemptId, lastQuestion.question_id, correct, eventId);
    const reveal = await p.reveal(attemptId, lastQuestion.question_id);
    expect(done.attempt_completed).toBe(true);
    expect(replay.attempt_completed).toBe(false);
    expect(reveal.attempt_completed).toBe(false);
    expect(await totalXp(t, p.userId)).toBe(4 * 50 + 25 + 500);
  });

  it("keeps every attempt separately: a new attempt does not overwrite the previous one", async () => {
    const p = await newPlayer();
    const first = await p.play("mini");
    const second = await p.play("mini", () => 1);
    const { rows } = await t.db.query<{ id: string; xp_earned: number; accuracy: string }>(
      "select id, xp_earned, accuracy::text from public.quiz_attempts where user_id = $1 order by started_at",
      [p.userId],
    );
    expect(rows).toEqual([
      { id: first.attemptId, xp_earned: 250, accuracy: "100.00" },
      { id: second.attemptId, xp_earned: 125, accuracy: "0.00" },
    ]);
    expect(await totalXp(t, p.userId)).toBe(250 + 500 + 125 + 500);
  });

  it("records accuracy as first-try correct answers over questions", async () => {
    const p = await newPlayer();
    const { last } = await p.play("mini", (i) => (i < 2 ? 1 : 0));
    expect(last.attempt).toMatchObject({ first_try_count: 3, correct_count: 5, accuracy: 60 });
  });
});

describe("starting attempts", () => {
  it("picks the requested number of questions at the requested level", async () => {
    const p = await newPlayer();
    const attemptId = await p.start("big", { count: 10 });
    const { attempt, questions } = await p.attempt(attemptId);
    expect(attempt).toMatchObject({ total_questions: 10, level_filter: "all", mode: "official" });
    expect(new Set(questions.map((q) => q.question_id)).size).toBe(10);
    expect(questions.every((q) => q.options.length === 4)).toBe(true);
  });

  it("rejects unknown quizzes, languages and levels", async () => {
    const p = await newPlayer();
    expect(await expectDbError(p.start("does-not-exist"))).toContain("quiz_not_found");
    expect(await expectDbError(p.start("mini", { language: "fr" }))).toContain("invalid_language");
    expect(await expectDbError(p.start("mini", { level: "expert" }))).toContain("invalid_level");
    expect(await expectDbError(p.start("mini", { level: "advanced" }))).toContain("no_questions");
  });
});
