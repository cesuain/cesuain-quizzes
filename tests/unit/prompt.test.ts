import { describe, expect, it } from "vitest";
import reactEn from "../../data/quizzes/react/en.json";
import { buildQuizPrompt, slugify, type PromptRequest } from "../../lib/quiz/prompt";
import { validateQuizJson } from "../../lib/quiz/schema";
import type { Quiz } from "../../lib/types";

const quiz = reactEn as Quiz;
const example = { quizId: quiz.id, language: quiz.language, title: quiz.title, question: quiz.questions[0] };

const request: PromptRequest = {
  topic: "PostgreSQL indexing",
  objectives: "B-tree vs GIN, partial indexes, EXPLAIN",
  difficulty: "intermediate",
  questionCount: 12,
  language: "en",
  context: "",
  instructions: "",
};

describe("custom quiz prompt", () => {
  const prompt = buildQuizPrompt(request, example);

  it("describes the subject, objectives, difficulty and count", () => {
    expect(prompt).toContain("Topic: PostgreSQL indexing");
    expect(prompt).toContain("B-tree vs GIN, partial indexes, EXPLAIN");
    expect(prompt).toContain('Every question must be "intermediate"');
    expect(prompt).toContain("exactly 12 question objects");
  });

  it("documents every field of the real schema and forbids others", () => {
    for (const field of ['"id"', '"language"', '"title"', '"questions"', '"level"', '"question"', '"correctAnswer"', '"wrongAnswers"', '"explanation"']) {
      expect(prompt).toContain(field);
    }
    expect(prompt).toContain("exactly 3 strings");
    expect(prompt).toContain('"basic", "intermediate", "advanced"');
    expect(prompt).toContain("Unknown fields are rejected");
    expect(prompt).toContain("no Markdown code fences");
  });

  it("includes a real question from data/quizzes as the example, and the example validates", () => {
    expect(prompt).toContain(JSON.stringify(quiz.questions[0].question));
    const exampleJson = prompt.slice(prompt.lastIndexOf("\n{") + 1);
    const result = validateQuizJson(exampleJson);
    expect(result.ok).toBe(true);
  });

  it("asks for a slug id that the schema accepts", () => {
    expect(prompt).toContain('Use "postgresql-indexing"');
    expect(slugify("Ação & Reação — Física!")).toBe("acao-reacao-fisica");
    expect(slugify("!!!")).toBe("custom-quiz");
  });

  it("supports mixed difficulty, Portuguese, context and free-form instructions", () => {
    const mixed = buildQuizPrompt(
      { ...request, topic: "", difficulty: "mixed", language: "pt-br", context: "Chapter 3 notes", instructions: "Focus on query planning" },
      example,
    );
    expect(mixed).toContain("about a third");
    expect(mixed).toContain("Brazilian Portuguese");
    expect(mixed).toContain('"language" (string): "pt-br"');
    expect(mixed).toContain("Chapter 3 notes");
    expect(mixed).toContain("Focus on query planning");
  });

  it("clamps the question count to the supported range", () => {
    expect(buildQuizPrompt({ ...request, questionCount: 500 }, example)).toContain("exactly 50 question objects");
    expect(buildQuizPrompt({ ...request, questionCount: 0 }, example)).toContain("exactly 1 question objects");
  });
});
