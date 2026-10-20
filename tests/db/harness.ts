import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import achievementsJson from "../../data/achievements.json";
import { parseAchievementCatalog } from "../../lib/achievements/catalog";
import { buildSeedSql } from "../../lib/seed/build-seed";
import type { Quiz, QuizQuestion } from "../../lib/types";

/**
 * Runs the real migrations in an in-process Postgres (PGlite) with the pieces of Supabase they
 * rely on stubbed: the anon/authenticated/service_role roles, default privileges, auth.users
 * and auth.uid() reading the JWT claims setting exactly like Supabase does.
 */

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;
`;

export function makeQuestion(id: number, level: QuizQuestion["level"] = "basic"): QuizQuestion {
  return {
    id,
    level,
    question: `Question ${id}?`,
    correctAnswer: `Correct ${id}`,
    wrongAnswers: [`Wrong ${id}a`, `Wrong ${id}b`, `Wrong ${id}c`],
    explanation: `Because ${id}.`,
  };
}

export function makeQuiz(id: string, title: string, count: number, level: QuizQuestion["level"] = "basic"): Quiz[] {
  const questions = Array.from({ length: count }, (_, i) => makeQuestion(i + 1, level));
  return [
    { id, language: "en", title, questions },
    { id, language: "pt-br", title: `${title} (pt)`, questions },
  ];
}

/** Fixture content: small quizzes with the real achievement catalog. */
export const FIXTURE_QUIZZES: Quiz[][] = [
  makeQuiz("react", "React", 12),
  makeQuiz("javascript", "JavaScript", 10),
  makeQuiz("typescript", "TypeScript", 10),
  makeQuiz("mini", "Mini", 5),
  makeQuiz("big", "Big", 60),
];

export interface TestDb {
  db: PGlite;
  /** Runs `fn` as the `authenticated` role with `userId` as the JWT subject. */
  asUser<T>(userId: string, fn: () => Promise<T>): Promise<T>;
  asAnon<T>(fn: () => Promise<T>): Promise<T>;
  createUser(email?: string): Promise<string>;
}

export async function createTestDb(options: { seedSql?: string } = {}): Promise<TestDb> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);

  const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
  await db.exec(options.seedSql ?? buildSeedSql(FIXTURE_QUIZZES, parseAchievementCatalog(achievementsJson)));

  async function as<T>(role: "authenticated" | "anon", claims: object, fn: () => Promise<T>): Promise<T> {
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)]);
    await db.exec(`set role ${role}`);
    try {
      return await fn();
    } finally {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claims', '', false)");
    }
  }

  return {
    db,
    asUser: (userId, fn) => as("authenticated", { sub: userId, role: "authenticated" }, fn),
    asAnon: (fn) => as("anon", { role: "anon" }, fn),
    async createUser(email) {
      const id = randomUUID();
      await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email ?? `${id}@example.test`]);
      return id;
    },
  };
}

// ---------------------------------------------------------------------------
// Typed helpers around the client API
// ---------------------------------------------------------------------------

export interface AttemptQuestionJson {
  question_id: string;
  position: number;
  level: string;
  prompt: string;
  options: { id: string; body: string }[];
  outcome: string;
  submissions: number;
  xp_awarded: number;
  tried_option_ids: string[];
  correct_option_id: string | null;
  explanation: string | null;
}

export interface SubmitResult {
  replayed: boolean;
  response_id: string;
  is_correct: boolean;
  submission_number: number;
  xp_awarded: number;
  question: AttemptQuestionJson;
  attempt: Record<string, unknown> & { status: string; xp_earned: number; completion_bonus: number };
  attempt_completed: boolean;
  unlocked_achievements: { slug: string; name: string }[];
}

export class Player {
  constructor(
    private readonly t: TestDb,
    readonly userId: string,
  ) {}

  run<T>(fn: () => Promise<T>) {
    return this.t.asUser(this.userId, fn);
  }

  async start(quizId: string, opts: { level?: string; count?: number; language?: string } = {}): Promise<string> {
    const { rows } = await this.run(() =>
      this.t.db.query<{ id: string }>("select public.start_attempt($1, $2, $3, $4, 0) as id", [
        quizId,
        opts.language ?? "en",
        opts.level ?? "all",
        opts.count ?? 0,
      ]),
    );
    return rows[0].id;
  }

  async attempt(attemptId: string) {
    const { rows } = await this.run(() =>
      this.t.db.query<{
          data: { attempt: Record<string, unknown>; questions: AttemptQuestionJson[]; unlocked_achievements: { slug: string }[] };
        }>(
        "select public.get_attempt($1) as data",
        [attemptId],
      ),
    );
    return rows[0].data;
  }

  async submit(attemptId: string, questionId: string, optionId: string | null, eventId = randomUUID()) {
    const { rows } = await this.run(() =>
      this.t.db.query<{ data: SubmitResult }>("select public.submit_answer($1, $2, $3, $4) as data", [
        attemptId,
        questionId,
        optionId,
        eventId,
      ]),
    );
    return rows[0].data;
  }

  async reveal(attemptId: string, questionId: string) {
    const { rows } = await this.run(() =>
      this.t.db.query<{ data: SubmitResult }>("select public.reveal_answer($1, $2) as data", [attemptId, questionId]),
    );
    return rows[0].data;
  }

  /** Answer key, read as the database owner (tests only). */
  async correctOption(questionId: string): Promise<string> {
    const { rows } = await this.t.db.query<{ id: string }>(
      "select id from public.answer_options where question_id = $1 and is_correct",
      [questionId],
    );
    return rows[0].id;
  }

  async wrongOptions(question: AttemptQuestionJson): Promise<string[]> {
    const correct = await this.correctOption(question.question_id);
    return question.options.map((o) => o.id).filter((id) => id !== correct);
  }

  async answerCorrectly(attemptId: string, question: AttemptQuestionJson) {
    return this.submit(attemptId, question.question_id, await this.correctOption(question.question_id));
  }

  async answerWrong(attemptId: string, question: AttemptQuestionJson, which = 0) {
    return this.submit(attemptId, question.question_id, (await this.wrongOptions(question))[which]);
  }

  /** Plays a whole attempt. `plan[i]` is the number of wrong answers before the right one (Infinity = reveal). */
  async play(quizId: string, plan: (q: number) => number = () => 0, opts: { level?: string; count?: number } = {}) {
    const attemptId = await this.start(quizId, opts);
    const { questions } = await this.attempt(attemptId);
    const unlocked: string[] = [];
    let last: SubmitResult | undefined;
    for (const [index, question] of questions.entries()) {
      const misses = plan(index);
      const wrongs = Math.min(misses, 3);
      for (let i = 0; i < wrongs; i++) {
        last = await this.answerWrong(attemptId, question, i);
        unlocked.push(...last.unlocked_achievements.map((a) => a.slug));
      }
      last = misses === Infinity ? await this.reveal(attemptId, question.question_id) : await this.answerCorrectly(attemptId, question);
      unlocked.push(...last.unlocked_achievements.map((a) => a.slug));
    }
    return { attemptId, unlocked, last: last! };
  }
}

export async function totalXp(t: TestDb, userId: string): Promise<number> {
  const { rows } = await t.db.query<{ total: number }>(
    "select coalesce(sum(amount), 0)::int as total from public.xp_ledger where user_id = $1",
    [userId],
  );
  return rows[0].total;
}

export async function unlockedSlugs(t: TestDb, userId: string): Promise<string[]> {
  const { rows } = await t.db.query<{ slug: string }>(
    `select a.slug from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id
     where ua.user_id = $1 order by a.slug`,
    [userId],
  );
  return rows.map((r) => r.slug);
}

export async function expectDbError(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("Expected the database call to fail");
}
