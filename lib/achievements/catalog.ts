import { z } from "zod";
import { LEVELS, QUIZ_ID_PATTERN } from "../types";

/**
 * Achievement catalog, configured in data/achievements.json and loaded into the
 * `achievements` table by the seed. Criteria are data: the database evaluates them in
 * `private.achievement_progress`, and the `achievements` table rejects malformed config with
 * the same rules as below.
 */

export const ACHIEVEMENT_CATEGORIES = ["completion", "accuracy", "streak", "milestone", "exploration"] as const;
export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number];

export const ACHIEVEMENT_RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type AchievementRarity = (typeof ACHIEVEMENT_RARITIES)[number];

/** Icon identifiers the app can render (lucide names). See components/achievements/AchievementIcon.tsx. */
export const ACHIEVEMENT_ICONS = [
  "footprints",
  "compass",
  "book-open-check",
  "crown",
  "badge-check",
  "layers",
  "atom",
  "zap",
  "flame",
  "rocket",
  "lightbulb",
  "search",
  "blocks",
  "graduation-cap",
  "trophy",
  "target",
  "crosshair",
  "medal",
] as const;
export type AchievementIconName = (typeof ACHIEVEMENT_ICONS)[number];

const count = z.strictObject({ count: z.number().int().positive() });

/**
 * Counting semantics (all over official attempts only):
 * - quizzes_completed: completed attempts (retakes count).
 * - correct_answers: questions answered correctly on any try, across all attempts.
 * - first_try_correct: questions answered correctly on the first submission.
 * - correct_streak: longest run of consecutive correct submissions; any wrong submission or
 *   timeout resets it, even if the same question is then answered correctly.
 * - quiz_accuracy: a completed attempt with at least `min_questions` questions whose accuracy
 *   (first-try correct ÷ questions) is at least `min_accuracy` percent.
 * - quiz_completed: a completed attempt of `quiz_id` (stable id, not title), optionally with a
 *   minimum accuracy.
 * - level_completed: a completed attempt filtered to `level` for every quiz in `quiz_ids`.
 */
export const achievementCriteriaSchema = z.discriminatedUnion("criteria_type", [
  z.object({ criteria_type: z.literal("quizzes_completed"), criteria_config: count }),
  z.object({ criteria_type: z.literal("correct_answers"), criteria_config: count }),
  z.object({ criteria_type: z.literal("first_try_correct"), criteria_config: count }),
  z.object({ criteria_type: z.literal("correct_streak"), criteria_config: count }),
  z.object({
    criteria_type: z.literal("quiz_accuracy"),
    criteria_config: z.strictObject({
      min_accuracy: z.number().min(0).max(100),
      min_questions: z.number().int().min(1),
    }),
  }),
  z.object({
    criteria_type: z.literal("quiz_completed"),
    criteria_config: z.strictObject({
      quiz_id: z.string().regex(QUIZ_ID_PATTERN),
      min_accuracy: z.number().min(0).max(100).optional(),
    }),
  }),
  z.object({
    criteria_type: z.literal("level_completed"),
    criteria_config: z.strictObject({
      level: z.enum(LEVELS),
      quiz_ids: z.array(z.string().regex(QUIZ_ID_PATTERN)).min(1),
    }),
  }),
]);

export type AchievementCriteria = z.infer<typeof achievementCriteriaSchema>;
export type CriteriaType = AchievementCriteria["criteria_type"];

const achievementBaseSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(240),
  icon: z.enum(ACHIEVEMENT_ICONS),
  category: z.enum(ACHIEVEMENT_CATEGORIES),
  rarity: z.enum(ACHIEVEMENT_RARITIES).default("common"),
  is_active: z.boolean().default(true),
});

export const achievementDefinitionSchema = z.intersection(achievementBaseSchema, achievementCriteriaSchema);
export type AchievementDefinition = z.infer<typeof achievementDefinitionSchema>;

export const achievementCatalogSchema = z.array(achievementDefinitionSchema).superRefine((catalog, ctx) => {
  const seen = new Set<string>();
  catalog.forEach((achievement, index) => {
    if (seen.has(achievement.slug)) {
      ctx.addIssue({ code: "custom", path: [index, "slug"], message: `duplicate slug ${achievement.slug}` });
    }
    seen.add(achievement.slug);
  });
});

export function parseAchievementCatalog(value: unknown): AchievementDefinition[] {
  return achievementCatalogSchema.parse(value);
}

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  completion: "Quiz completion",
  accuracy: "Accuracy",
  streak: "Streaks",
  milestone: "Question milestones",
  exploration: "Exploration",
};
