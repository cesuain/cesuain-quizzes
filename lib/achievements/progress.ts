import type { AchievementProgress } from "../data/types";

export function progressRatio(a: Pick<AchievementProgress, "current_value" | "target_value">): number {
  if (a.target_value <= 0) return 1;
  return Math.min(1, a.current_value / a.target_value);
}

/** e.g. "3 of 5 quizzes completed", "best 83.3% of 80%". */
export function progressLabel(a: Pick<AchievementProgress, "criteria_type" | "current_value" | "target_value">): string {
  const current = Math.round(a.current_value * 10) / 10;
  switch (a.criteria_type) {
    case "quizzes_completed":
      return `${current} of ${a.target_value} quizzes completed`;
    case "correct_answers":
      return `${current} of ${a.target_value} questions answered correctly`;
    case "first_try_correct":
      return `${current} of ${a.target_value} correct on the first try`;
    case "correct_streak":
      return `Best streak ${current} of ${a.target_value}`;
    case "quiz_accuracy":
      return `Best accuracy ${current}% of ${a.target_value}%`;
    case "quiz_completed":
      return current >= 1 ? "Completed" : "Not completed yet";
    case "level_completed":
      return `${current} of ${a.target_value} quizzes completed at this level`;
    default:
      return `${current} of ${a.target_value}`;
  }
}

/** The locked achievement closest to being unlocked. */
export function nextMilestone(achievements: AchievementProgress[]): AchievementProgress | null {
  const locked = achievements.filter((a) => !a.unlocked_at);
  if (locked.length === 0) return null;
  return locked.reduce((best, a) => (progressRatio(a) > progressRatio(best) ? a : best));
}
