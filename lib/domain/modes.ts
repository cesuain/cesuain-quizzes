/**
 * The two ways to play a quiz. The policy is what the code branches on; UI labels follow from
 * it, never the other way round.
 *
 * - `official`: curated quizzes. Attempts, responses, XP and achievements live in Supabase and
 *   are computed there (supabase/migrations). The browser only sends which option was chosen.
 * - `custom_practice`: imported quizzes. Session-only, in browser memory. Nothing is sent to the
 *   server, so there is nothing that could award XP, unlock achievements or touch statistics.
 */
export const QUIZ_MODES = ["official", "custom_practice"] as const;
export type QuizMode = (typeof QUIZ_MODES)[number];

export interface ModePolicy {
  persistsAttempts: boolean;
  awardsXp: boolean;
  unlocksAchievements: boolean;
  countsTowardStatistics: boolean;
}

export const MODE_POLICIES: Readonly<Record<QuizMode, Readonly<ModePolicy>>> = Object.freeze({
  official: Object.freeze({
    persistsAttempts: true,
    awardsXp: true,
    unlocksAchievements: true,
    countsTowardStatistics: true,
  }),
  custom_practice: Object.freeze({
    persistsAttempts: false,
    awardsXp: false,
    unlocksAchievements: false,
    countsTowardStatistics: false,
  }),
});
