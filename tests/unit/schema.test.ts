import { describe, expect, it } from "vitest";
import { readAllOfficialQuizzes } from "../../lib/quiz/official-content";
import { validateQuizJson } from "../../lib/quiz/schema";

const valid = {
  id: "css-grid",
  language: "en",
  title: "CSS Grid",
  questions: [
    {
      id: 1,
      level: "basic",
      question: "Which property turns an element into a grid container?",
      correctAnswer: "display: grid",
      wrongAnswers: ["position: grid", "grid: on", "layout: grid"],
      explanation: "display: grid creates a grid formatting context.",
    },
    {
      id: 2,
      level: "intermediate",
      question: "What does fr stand for?",
      correctAnswer: "A fraction of the free space",
      wrongAnswers: ["A fixed row height", "A font-relative unit", "A frame rate"],
    },
  ],
};

const json = (value: unknown) => JSON.stringify(value, null, 2);

function issues(source: string) {
  const result = validateQuizJson(source);
  if (result.ok) throw new Error("expected validation to fail");
  return result.issues;
}

describe("quiz schema", () => {
  it("accepts every official quiz file (the importer uses the same schema)", async () => {
    const groups = await readAllOfficialQuizzes();
    expect(groups.length).toBeGreaterThanOrEqual(8);
    for (const group of groups) expect(group.map((q) => q.language)).toEqual(["en", "pt-br"]);
  });

  it("accepts a valid quiz and returns it unchanged", () => {
    const result = validateQuizJson(json(valid));
    expect(result).toEqual({ ok: true, quiz: valid });
  });

  it("reports JSON syntax errors with a line and column", () => {
    const [issue] = issues('{\n  "id": "x",\n  "title": oops\n}');
    expect(issue.message).toMatch(/^Invalid JSON at line 3, column \d+/);
  });

  it("explains Markdown fences instead of silently stripping them", () => {
    const [issue] = issues("```json\n" + json(valid) + "\n```");
    expect(issue.message).toContain("code fence");
  });

  it("reports missing and mistyped fields with their path", () => {
    const broken = structuredClone(valid) as Record<string, unknown> & { questions: Record<string, unknown>[] };
    delete broken.title;
    broken.questions[0].level = "expert";
    broken.questions[1].id = "2";
    const found = issues(json(broken));
    expect(found).toEqual(
      expect.arrayContaining([
        { path: "title", message: "title must be a string" },
        { path: "questions[0].level", message: "level must be one of: basic, intermediate, advanced" },
        { path: "questions[1].id", message: "id must be a number" },
      ]),
    );
  });

  it("requires exactly three distinct wrong answers that differ from the correct one", () => {
    const broken = structuredClone(valid);
    broken.questions[0].wrongAnswers = ["position: grid", "grid: on"];
    broken.questions[1].wrongAnswers = ["A frame rate", " a frame rate ", "A FRACTION of the free space"];
    const found = issues(json(broken));
    expect(found).toEqual(
      expect.arrayContaining([
        { path: "questions[0].wrongAnswers", message: "wrongAnswers must contain exactly 3 answers" },
        { path: "questions[1].wrongAnswers[1]", message: "duplicate wrong answer" },
        { path: "questions[1].wrongAnswers[2]", message: "a wrong answer is identical to correctAnswer" },
      ]),
    );
  });

  it("detects duplicate question ids", () => {
    const broken = structuredClone(valid);
    broken.questions[1].id = 1;
    expect(issues(json(broken))).toContainEqual({
      path: "questions[1].id",
      message: "duplicate question id 1 (also used by questions[0])",
    });
  });

  it("rejects unknown fields instead of dropping them", () => {
    const broken = { ...structuredClone(valid), difficulty: "easy" } as Record<string, unknown>;
    (broken.questions as Record<string, unknown>[])[0].options = ["a", "b"];
    const found = issues(json(broken));
    expect(found).toEqual(
      expect.arrayContaining([
        { path: "", message: 'unknown field "difficulty" (not part of the quiz format)' },
        { path: "questions[0]", message: 'unknown field "options" (not part of the quiz format)' },
      ]),
    );
  });

  it("rejects blank strings, bad ids and non-object roots", () => {
    const broken = structuredClone(valid);
    broken.id = "CSS Grid!";
    broken.questions[0].question = "   ";
    const found = issues(json(broken));
    expect(found).toEqual(
      expect.arrayContaining([
        { path: "id", message: "id may only contain lowercase letters, digits and hyphens" },
        { path: "questions[0].question", message: "question must not be empty" },
      ]),
    );
    expect(issues("[]")[0].message).toBe("the quiz must be a JSON object");
    expect(issues("   ")[0].message).toBe("Paste the quiz JSON first.");
  });

  it("treats HTML and script-like content as plain data", () => {
    const hostile = structuredClone(valid);
    hostile.title = '<img src=x onerror="alert(1)">';
    hostile.questions[0].question = "<script>window.pwned = true</script>";
    const result = validateQuizJson(json(hostile));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.quiz.questions[0].question).toBe("<script>window.pwned = true</script>");
    expect((globalThis as Record<string, unknown>).pwned).toBeUndefined();
  });

  it("never evaluates the input", () => {
    const result = validateQuizJson('(() => { globalThis.evaluated = true; return {} })()');
    expect(result.ok).toBe(false);
    expect((globalThis as Record<string, unknown>).evaluated).toBeUndefined();
  });
});

describe("JSON error locations", () => {
  it.each([
    ['{"a": 1,}', 1, 9],
    ['{\n  "a": [1, 2\n}', 3, 1],
    ['{"a": "line\nbreak"}', 1, 12],
    ['{"a": tru}', 1, 7],
    ['{"a": 1} extra', 1, 10],
    ["{'a': 1}", 1, 2],
  ])("%j fails at line %i, column %i", (source, line, column) => {
    const [issue] = issues(source);
    expect(issue.message).toContain(`line ${line}, column ${column}`);
  });
});
