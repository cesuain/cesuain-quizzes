import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MODE_POLICIES } from "../../lib/domain/modes";
import { completionBonus, xpForSubmission } from "../../lib/domain/scoring";
import {
  PracticeError,
  answerPractice,
  practiceSummary,
  revealPractice,
  startPractice,
} from "../../lib/practice/session";
import type { Quiz } from "../../lib/types";

const quiz: Quiz = {
  id: "custom",
  language: "en",
  title: "Custom",
  questions: Array.from({ length: 4 }, (_, i) => ({
    id: i + 1,
    level: "basic" as const,
    question: `Q${i + 1}`,
    correctAnswer: `right ${i + 1}`,
    wrongAnswers: [`w${i + 1}a`, `w${i + 1}b`, `w${i + 1}c`],
    explanation: `because ${i + 1}`,
  })),
};

const settings = { level: "all" as const, count: 0, secondsPerQuestion: 0 };

function wrongOption(session: ReturnType<typeof startPractice>, index: number, n = 0) {
  const q = session.questions[index];
  return q.options.filter((o) => o.id !== session.answerKey[q.id])[n].id;
}

describe("custom practice engine", () => {
  it("plays with the same retry rules as official attempts", () => {
    let session = startPractice(quiz, settings);
    const q0 = session.questions[0];

    let step = answerPractice(session, q0.id, wrongOption(session, 0));
    expect(step.result).toEqual({ isCorrect: false, submissionNumber: 1, outcome: "pending" });
    expect(step.session.questions[0].correctOptionId).toBeNull();
    session = step.session;

    step = answerPractice(session, q0.id, session.answerKey[q0.id]);
    expect(step.result).toEqual({ isCorrect: true, submissionNumber: 2, outcome: "correct" });
    expect(step.session.questions[0].explanation).toMatch(/^because/);
    session = step.session;

    expect(() => answerPractice(session, q0.id, session.answerKey[q0.id])).toThrow(PracticeError);
    expect(() => revealPractice(session, session.questions[1].id)).toThrow(/Answer the question/);

    session = answerPractice(session, session.questions[1].id, wrongOption(session, 1)).session;
    session = revealPractice(session, session.questions[1].id);
    expect(session.questions[1].outcome).toBe("revealed");

    session = answerPractice(session, session.questions[2].id, null).session;
    expect(session.questions[2].outcome).toBe("timed_out");

    session = answerPractice(session, session.questions[3].id, session.answerKey[session.questions[3].id]).session;
    expect(practiceSummary(session)).toEqual({
      total: 4,
      resolved: 4,
      correct: 2,
      firstTry: 1,
      completed: true,
      accuracy: 25,
    });
  });

  it("produces results that carry no XP or achievement data at all", () => {
    let session = startPractice(quiz, settings);
    const results = session.questions.map((q) => {
      const step = answerPractice(session, q.id, session.answerKey[q.id]);
      session = step.session;
      return step.result;
    });
    for (const result of results) expect(Object.keys(result).sort()).toEqual(["isCorrect", "outcome", "submissionNumber"]);
    const summary = practiceSummary(session);
    expect(Object.keys(summary)).not.toEqual(expect.arrayContaining(["xp"]));
    expect(JSON.stringify({ session, summary })).not.toMatch(/\bxp|achievement|bonus/i);
  });

  it("the custom_practice policy awards nothing", () => {
    expect(MODE_POLICIES.custom_practice).toEqual({
      persistsAttempts: false,
      awardsXp: false,
      unlocksAchievements: false,
      countsTowardStatistics: false,
    });
    expect(xpForSubmission("custom_practice", 1, true)).toBe(0);
    expect(xpForSubmission("custom_practice", 2, true)).toBe(0);
    expect(completionBonus("custom_practice")).toBe(0);
    expect(xpForSubmission("official", 1, true)).toBe(50);
    expect(Object.isFrozen(MODE_POLICIES.custom_practice)).toBe(true);
  });

  it("respects level and count settings", () => {
    const session = startPractice(quiz, { level: "all", count: 2, secondsPerQuestion: 0 });
    expect(session.questions).toHaveLength(2);
    expect(() => startPractice(quiz, { level: "advanced", count: 0, secondsPerQuestion: 0 })).toThrow(PracticeError);
  });
});

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && /\.(ts|tsx)$/.test(e.name))
    .map((e) => path.join(e.parentPath, e.name));
}

describe("custom practice has no path to the server", () => {
  it("practice code imports nothing that talks to Supabase or official server actions", async () => {
    const roots = ["lib/practice", "components/practice", "app/(app)/practice"].map((p) => path.join(process.cwd(), p));
    const files = (await Promise.all(roots.map(sourceFiles))).flat();
    expect(files.length).toBeGreaterThan(3);
    for (const file of files) {
      const source = await fs.readFile(file, "utf8");
      const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
      for (const specifier of imports) {
        expect(specifier, `${path.relative(process.cwd(), file)} imports ${specifier}`).not.toMatch(
          /supabase|lib\/data|lib\/auth|quizzes\/.*actions|\/actions$/,
        );
      }
      expect(source, path.relative(process.cwd(), file)).not.toMatch(/\bfetch\(|"use server"|localStorage|sessionStorage/);
    }
  });
});
