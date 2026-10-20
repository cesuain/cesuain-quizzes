# Interview Quizzes

A learning platform for interview practice. It has official quizzes that award XP and achievements, plus a custom quiz generator for private practice that is never saved.

- **Official quizzes** (`/quizzes`) need an account. Every attempt, answer, XP award and achievement is stored in Supabase Postgres and computed only on the server.
- **Custom practice** (`/practice`): build a ChatGPT prompt, paste the JSON it returns, and play it in the browser. Nothing is written to the database, and it never counts toward XP, achievements, history or stats.

Stack: Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript, Supabase (Auth, Postgres, RLS), Tailwind CSS 4, `@cesuain/ui` and `@cesuain/tokens`.

## Quick start

```bash
npm install
cp .env.example .env.local      # then fill in the values (see below)
npm run db:start                # local Supabase stack (needs Docker)
npm run db:reset                # applies migrations and the generated seed
npm run dev                     # http://localhost:3000
```

Without Supabase variables the app still builds and runs. The auth pages show a configuration notice instead of failing.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Project URL (`supabase status` prints it locally) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | Publishable (anon) key. RLS and the SQL API protect the data, so this key is safe to expose |
| `NEXT_PUBLIC_SITE_URL` | server | Public origin used in auth email links, e.g. `https://quizzes.example.com` |

The app never needs a service-role key. Do not add one to the environment. `.env*` files are ignored by git (except `.env.example`), so never commit real values.

## Supabase setup

### Local

`supabase/config.toml` is already set up. Email confirmation is off locally and the redirect URLs point to `/auth/confirm`. Run `npm run db:start` and then `npm run db:reset`. Emails sent locally go to Inbucket (the URL is printed by `supabase status`).

### Hosted project

1. Create a project and copy its URL and publishable key into your environment.
2. Run `npx supabase link --project-ref <ref>`, then `npm run db:push`. This regenerates `supabase/seed.sql` and pushes the migrations plus the seed.
3. In **Authentication → URL Configuration**, set **Site URL** to your origin and add `https://<your-domain>/auth/confirm` (plus `http://localhost:3000/auth/confirm` for development) to **Redirect URLs**.
4. Keep email confirmations on in production. `/auth/confirm` handles both link styles: PKCE (`?code=`) and the token-hash templates (`?token_hash=&type=`), covering sign-up confirmation and password recovery.

### Types

`lib/supabase/database.types.ts` follows the `supabase gen types` format. It was written by hand because no database was reachable here. After any migration change, regenerate it with `npm run db:types` (this needs the local stack).

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm run lint` | ESLint (flat config) |
| `npm test` | Vitest: unit tests plus database tests that run the real migration in PGlite (in-process Postgres, no Docker) |
| `npm run test:e2e` | Playwright end-to-end flow; needs a running Supabase (see below) |
| `npm run db:seed:generate` | Rebuilds `supabase/seed.sql` from `data/` |
| `npm run db:reset` / `db:push` | Regenerates the seed and applies it locally or to the linked project |

### End-to-end tests

`tests/e2e/learning-flow.spec.ts` covers the full flow: sign up, finish an official quiz with every answer right on the first try (10 × 50 + 500 bonus = 1,000 XP), the "First Steps" unlock firing only once, persistence after a reload, generating and copying a prompt, a rejected and then an accepted JSON import, a practice run, and a check that XP, completed count and history are unchanged afterwards.

The spec needs a Supabase with email confirmations **off**, such as the local stack:

```bash
npm run db:start && npm run db:reset
npx playwright install chromium
npm run test:e2e                     # builds and starts the app; or set E2E_BASE_URL
```

## Deploying to Vercel

1. Import the repository and set the three environment variables for Production and Preview.
2. Run `npm run db:push` against the production project, and add the Vercel domain(s) to the Supabase redirect URLs.
3. Deploy. Pages that need a session are rendered per request. Only `/login`, `/signup` and similar pages are static.

## How it works

### Security model

- **Sessions.** `proxy.ts` refreshes the Supabase session cookie and redirects anonymous visitors away early. Every personal page also calls `requireUser()` on the server (`getClaims()` verifies the JWT), so the redirect in the proxy is never the only check.
- **Data access.** All tables have RLS. Clients get `SELECT` on their own rows only, and profiles can change `display_name` and nothing else. `questions` and `answer_options` have no client grants, so answer keys can't be read directly.
- **Gameplay functions.** Gameplay goes through `SECURITY DEFINER` functions such as `start_attempt`, `get_attempt`, `submit_answer`, `reveal_answer` and `abandon_attempt`. Only the `authenticated` role can call them. Each one checks `auth.uid()` and locks the rows it changes.
- **What the browser sends.** For an answer, the browser sends only `(attempt, question, option, client_event_id)`. Correctness, XP, timing and completion are all decided in SQL.
- **Answer keys.** The correct option and the explanation are returned only after a question is resolved.

### XP rules (official attempts only)

| Event | XP |
| --- | --- |
| Correct on the first try | 50 |
| Correct on the second try | 25 |
| Correct later, revealed, or timed out | 0 |
| Completing every question of the attempt | +500 once |

XP is written to `xp_ledger` with a unique `idempotency_key`: `question:<attempt>:<question>` and `completion:<attempt>`. Retrying a request with the same `client_event_id` returns the original result, and the ledger cannot award the same thing twice. Retaking a quiz creates a new attempt, which earns XP and the bonus again; the bonus is never paid twice for one attempt. Answers that are submitted again, or that conflict with an earlier one, are rejected with stable error codes such as `question_resolved` or `option_already_tried`. A user's level starts at 500 · n · (n − 1) total XP (`lib/domain/progression.ts`).

### Achievements

The catalog lives in `data/achievements.json` and is validated by `lib/achievements/catalog.ts`. The database also checks it, with a constraint on `achievements.criteria_config`. After each submission and each completion, `private.evaluate_achievements` computes progress and inserts any new unlocks with `ON CONFLICT DO NOTHING` (one row per user and achievement). Only rows that were actually inserted come back to the client, so a notification appears exactly once.

Criteria types (all count official attempts only):

| `criteria_type` | `criteria_config` | Meaning |
| --- | --- | --- |
| `quizzes_completed` | `{ count }` | Completed attempts (retakes count) |
| `correct_answers` | `{ count }` | Questions answered correctly on any try |
| `first_try_correct` | `{ count }` | Questions answered correctly on the first try |
| `correct_streak` | `{ count }` | Longest run of correct submissions; any wrong answer or timeout resets it |
| `quiz_accuracy` | `{ min_accuracy, min_questions }` | One completed attempt with at least `min_questions` questions and first-try accuracy ≥ `min_accuracy` % |
| `quiz_completed` | `{ quiz_id, min_accuracy? }` | A completed attempt of one quiz, identified by its stable id |
| `level_completed` | `{ level, quiz_ids }` | A completed attempt at `level` for each quiz in the list |

To add an achievement, append an entry to the JSON (choose an icon from `ACHIEVEMENT_ICONS`), then run `npm run db:reset` or `db:push`. The seed is idempotent: it updates existing rows by slug and deactivates achievements that were removed, without deleting anyone's unlocks. A new criteria type also needs a branch in `private.achievement_progress` (in a new migration) and in the zod schema.

## Quiz content

### Adding an official quiz

Create `data/quizzes/<id>/en.json` and `pt-br.json`, where `<id>` is lowercase letters, digits and hyphens. Then run `npm run db:reset` or `db:push`. The seed upserts each quiz by id and each question by `(quiz, id)`. Questions removed from the files are deactivated rather than deleted, so history stays intact. Official content comes only from these files, and nothing a user imports can change it.

### JSON schema

Official files and custom imports use the same schema (`lib/quiz/schema.ts`):

```json
{
  "id": "react",
  "language": "en",
  "title": "React",
  "questions": [
    {
      "id": 1,
      "level": "basic",
      "question": "…",
      "correctAnswer": "…",
      "wrongAnswers": ["…", "…", "…"],
      "explanation": "Optional. Shown after the question is resolved."
    }
  ]
}
```

Rules:
- `language` is `en` or `pt-br`.
- `level` is `basic`, `intermediate` or `advanced`.
- Each question has exactly 3 distinct wrong answers, and none of them may equal the correct answer.
- Question ids are unique positive integers.
- Unknown fields are rejected.
- Length limits: title 120, question 2,000, answer 1,000, explanation 2,000. At most 200 questions per quiz.
- `explanation` is the one addition to the original format. It is optional, so existing files stay valid.

### Custom quiz generator

`/practice/create` turns a topic, language, difficulty, question count and extra instructions into a prompt (`lib/quiz/prompt.ts`). The prompt includes the schema rules above and an example built from the same constants the validator uses (`LEVELS`, `WRONG_ANSWER_COUNT`, `LIMITS`), so the prompt and the validator always agree. **Copy Prompt** copies it, and **Open ChatGPT** opens `https://chatgpt.com/` in a new tab.

`/practice/import` parses the pasted JSON:
- It rejects code fences and reports JSON syntax errors with their line and column.
- It validates against the schema and shows a preview.
- It never changes the input. Text is rendered as plain React text, never as HTML, and nothing is run as code.

The session lives in React state (`components/practice/PracticeProvider.tsx`) and disappears on refresh. `lib/practice/session.ts` has no XP fields at all, and the tests check that practice never reaches the server.

## Project layout

```
app/(auth)/             login, signup, password reset (server actions)
app/auth/confirm/       email link handler
app/(app)/              dashboard, quizzes, results, history, progress, achievements, practice
components/             UI built on @cesuain/ui
lib/quiz/               schema, prompt builder, official content loader
lib/practice/           in-memory practice engine
lib/data/               server-only queries and DTOs
lib/seed/, scripts/     seed SQL generator
supabase/migrations/    schema, RLS, SQL API
tests/unit, tests/db    Vitest (db tests run the migration in PGlite)
tests/e2e               Playwright
```

## Known limitations

- The app chrome is in English. The quiz player and content support English and Brazilian Portuguese.
- The server does not enforce the per-question timer. A timeout is recorded as a submission with no option, which earns no XP. Response times are measured on the server and capped. The countdown restarts when an attempt is resumed.
- `npm audit` reports advisories in the dev-only `eslint-config-next` dependency chain. They are not shipped to production.
