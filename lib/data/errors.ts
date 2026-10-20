/** User-facing messages for the error codes raised by the database client API. */
const MESSAGES = {
  not_authenticated: "Your session has expired. Sign in again to continue.",
  attempt_not_found: "This attempt does not exist or belongs to another account.",
  attempt_closed: "This attempt is already finished.",
  question_not_in_attempt: "This question is not part of the attempt.",
  question_resolved: "This question is already resolved.",
  option_already_tried: "You already tried that answer.",
  invalid_option: "That answer is not an option for this question.",
  answer_first: "Answer the question before revealing it.",
  idempotency_conflict: "This answer was already submitted differently. Reload the page.",
  quiz_not_found: "This quiz is not available.",
  invalid_language: "This quiz is not available in that language.",
  invalid_level: "Choose a valid level.",
  invalid_count: "Choose a valid number of questions.",
  invalid_time_limit: "Choose a valid time limit.",
  no_questions: "No questions match these settings.",
} as const;

export type DataErrorCode = keyof typeof MESSAGES | "unknown";

export function errorCode(message: string): DataErrorCode {
  return (Object.keys(MESSAGES) as (keyof typeof MESSAGES)[]).find((code) => message.includes(code)) ?? "unknown";
}

export function errorMessage(message: string): string {
  const code = errorCode(message);
  return code === "unknown" ? "Something went wrong. Please try again." : MESSAGES[code];
}
