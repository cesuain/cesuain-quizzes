import type { Metadata } from "next";
import reactQuiz from "@/data/quizzes/react/en.json";
import PromptBuilder from "@/components/practice/PromptBuilder";
import type { PromptExample } from "@/lib/quiz/prompt";
import type { Quiz } from "@/lib/types";

export const metadata: Metadata = { title: "Custom Quiz Generator" };

// The prompt's example is a real question from the official data, so it always matches the
// format the importer validates. Only this one question is sent to the browser.
const source = reactQuiz as Quiz;
const example: PromptExample = {
  quizId: source.id,
  language: source.language,
  title: source.title,
  question: source.questions[0],
};

export default function CreatePracticePage() {
  return <PromptBuilder example={example} />;
}
