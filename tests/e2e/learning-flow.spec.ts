import { expect, test, type Page } from "@playwright/test";
import reactEn from "../../data/quizzes/react/en.json";

// Answer key from the official source file, used only by the test to pick correct options.
const correctByPrompt = new Map(reactEn.questions.map((q) => [q.question, q.correctAnswer]));

const practiceQuiz = {
  id: "e2e-practice",
  language: "en",
  title: "E2E practice",
  questions: [1, 2, 3].map((id) => ({
    id,
    level: "basic",
    question: `Practice question ${id}?`,
    correctAnswer: `Right ${id}`,
    wrongAnswers: [`Wrong ${id}a`, `Wrong ${id}b`, `Wrong ${id}c`],
    explanation: `Explanation ${id}`,
  })),
};

async function statValue(page: Page, label: string) {
  return page.locator('[data-slot="stat-card"]', { hasText: label }).locator("p").first().innerText();
}

test("official quiz, achievements and isolated custom practice", async ({ page, context }) => {
  // 1. Register (local stack: email confirmations disabled, so sign-up signs in).
  const email = `e2e-${Date.now()}@example.test`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Protected routes require the session.
  const anonymous = await context.browser()!.newContext();
  const anonPage = await anonymous.newPage();
  await anonPage.goto(new URL("/dashboard", page.url()).toString());
  await expect(anonPage).toHaveURL(/\/login/);
  await anonymous.close();

  // 2. Complete an official quiz: 10 questions, all correct on the first try.
  await page.goto("/quizzes/react");
  await page.getByRole("radio", { name: "No limit" }).click();
  await page.getByRole("button", { name: "Start official attempt" }).click();
  await expect(page).toHaveURL(/\/quizzes\/react\/play\?attempt=/);

  for (let i = 0; i < 10; i++) {
    const prompt = await page.getByRole("heading", { level: 2 }).innerText();
    const correct = correctByPrompt.get(prompt);
    expect(correct, `answer key for "${prompt}"`).toBeTruthy();
    await page.getByRole("button", { name: new RegExp(`^[A-D]\\. ${escape(correct!)}`) }).click();
    await expect(page.getByText("+50 XP")).toBeVisible();
    await page.getByRole("button", { name: i === 9 ? "See results" : "Next question" }).first().click();
  }

  // 3–5. XP, completion bonus and the First Steps notification.
  await expect(page).toHaveURL(/\/results\//);
  await expect(page.getByText("Achievement unlocked: First Steps")).toBeVisible();
  expect(await statValue(page, "XP earned")).toBe("1000");

  // 6. Refresh: results persist and the notification is not repeated.
  await page.reload();
  expect(await statValue(page, "XP earned")).toBe("1000");
  await expect(page.getByText("Achievement unlocked: First Steps")).toHaveCount(0);

  await page.goto("/dashboard");
  expect(await statValue(page, "Total XP")).toBe("1,000");
  expect(await statValue(page, "Quizzes completed")).toBe("1");
  await page.goto("/history");
  const attemptsBefore = await page.locator("tbody tr").count();
  expect(attemptsBefore).toBe(1);

  // 7–8. Generate a prompt, copy it and check the ChatGPT link.
  await page.goto("/practice/create");
  await page.getByLabel("Topic or subject").fill("CSS Grid");
  await page.getByRole("button", { name: "Generate Prompt" }).click();
  await page.getByRole("button", { name: "Copy Prompt" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("Topic: CSS Grid");
  await expect(page.getByRole("link", { name: /Open ChatGPT/ })).toHaveAttribute("href", "https://chatgpt.com/");

  // 9. Import JSON (an invalid paste first, then a valid one).
  await page.getByRole("link", { name: /I have the JSON/ }).click();
  const editor = page.getByLabel("Quiz JSON");
  await editor.fill('{"id": "x"}');
  await page.getByRole("button", { name: "Validate and preview" }).click();
  await expect(page.getByText(/problems? to fix/)).toBeVisible();
  await expect(editor).toHaveValue('{"id": "x"}');
  await editor.fill(JSON.stringify(practiceQuiz));
  await page.getByRole("button", { name: "Validate and preview" }).click();
  await expect(page.getByText("E2E practice")).toBeVisible();
  await page.getByRole("button", { name: "Start Practice" }).click();

  // 10. Complete the practice session.
  for (let i = 0; i < 3; i++) {
    const prompt = await page.getByRole("heading", { level: 2 }).innerText();
    const id = prompt.match(/\d+/)![0];
    await page.getByRole("button", { name: new RegExp(`^[A-D]\\. Right ${id}`) }).click();
    await expect(page.getByText("+50 XP")).toHaveCount(0);
    await page.getByRole("button", { name: i === 2 ? "See summary" : "Next question" }).click();
  }
  await expect(page.getByText("Practice complete")).toBeVisible();

  // 11. Nothing official changed.
  await page.goto("/dashboard");
  expect(await statValue(page, "Total XP")).toBe("1,000");
  expect(await statValue(page, "Quizzes completed")).toBe("1");
  await page.goto("/history");
  await expect(page.locator("tbody tr")).toHaveCount(attemptsBefore);
});

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
