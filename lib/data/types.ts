import type { PlayerQuestion, QuestionOutcome } from "../quiz/player";
import type { Language, Level, QuizSummary } from "../types";

/** Shapes returned by the database client API (supabase/migrations). Safe to send to the client. */

export type AttemptStatus = "in_progress" | "completed" | "abandoned";

export interface AttemptRow {
  id: string;
  quiz_id: string;
  language: Language;
  mode: "official";
  level_filter: Level | "all";
  seconds_per_question: number;
  status: AttemptStatus;
  total_questions: number;
  questions_answered: number;
  correct_count: number;
  incorrect_count: number;
  first_try_count: number;
  accuracy: number | null;
  xp_earned: number;
  completion_bonus: number;
  duration_seconds: number;
  started_at: string;
  last_activity_at: string;
  completed_at: string | null;
  abandoned_at: string | null;
}

export type AttemptSummary = Pick<
  AttemptRow,
  | "id"
  | "status"
  | "total_questions"
  | "questions_answered"
  | "correct_count"
  | "incorrect_count"
  | "first_try_count"
  | "accuracy"
  | "xp_earned"
  | "completion_bonus"
  | "duration_seconds"
  | "completed_at"
>;

export interface AttemptQuestionDto {
  question_id: string;
  position: number;
  level: Level;
  prompt: string;
  options: { id: string; body: string }[];
  outcome: QuestionOutcome;
  submissions: number;
  xp_awarded: number;
  tried_option_ids: string[];
  correct_option_id: string | null;
  explanation: string | null;
}

export interface ResponseDto {
  id: string;
  question_id: string;
  option_id: string | null;
  is_correct: boolean;
  submission_number: number;
  xp_awarded: number;
  duration_ms: number;
  created_at: string;
}

export interface UnlockedAchievement {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  category: string;
  unlocked_at: string;
}

export interface AttemptDetails {
  attempt: AttemptRow;
  quiz_title: string;
  questions: AttemptQuestionDto[];
  responses: ResponseDto[];
  unlocked_achievements: Pick<UnlockedAchievement, "slug" | "name" | "icon" | "unlocked_at">[];
}

export interface AnswerResult {
  replayed: boolean;
  is_correct: boolean;
  submission_number: number;
  xp_awarded: number;
  question: AttemptQuestionDto;
  attempt: AttemptSummary;
  attempt_completed: boolean;
  unlocked_achievements: UnlockedAchievement[];
}

export interface RevealResult {
  question: AttemptQuestionDto;
  attempt: AttemptSummary;
  attempt_completed: boolean;
  unlocked_achievements: UnlockedAchievement[];
}

export interface LevelStats {
  questions: number;
  first_try: number;
  correct: number;
}

export interface UserStats {
  total_xp: number;
  completed_attempts: number;
  in_progress_attempts: number;
  correct_answers: number;
  first_try_correct: number;
  submissions: number;
  questions_completed: number;
  first_try_in_completed: number;
  total_time_seconds: number;
  current_streak: number;
  best_streak: number;
  by_level: Partial<Record<Level, LevelStats>>;
}

export interface AchievementProgress {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: string;
  criteria_type: string;
  current_value: number;
  target_value: number;
  unlocked_at: string | null;
}

export type CatalogEntry = QuizSummary;

export function toPlayerQuestion(dto: AttemptQuestionDto): PlayerQuestion {
  return {
    id: dto.question_id,
    level: dto.level,
    prompt: dto.prompt,
    options: dto.options,
    outcome: dto.outcome,
    submissions: dto.submissions,
    triedOptionIds: dto.tried_option_ids,
    correctOptionId: dto.correct_option_id,
    explanation: dto.explanation,
  };
}

/** Overall official accuracy: first-try correct answers over questions in completed attempts. */
export function overallAccuracy(stats: Pick<UserStats, "first_try_in_completed" | "questions_completed">): number | null {
  if (!stats.questions_completed) return null;
  return Math.round((stats.first_try_in_completed / stats.questions_completed) * 1000) / 10;
}
