"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
} from "@cesuain/ui";
import { CheckCircle2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { LANGUAGE_LABELS, levelLabels } from "@/lib/i18n";
import { startPractice } from "@/lib/practice/session";
import { QUESTION_TYPES } from "@/lib/quiz/prompt";
import { validateQuizJson, type ValidationIssue } from "@/lib/quiz/schema";
import { COUNT_OPTIONS, TIME_OPTIONS } from "@/lib/quiz/settings";
import { LEVELS, type Level } from "@/lib/types";
import { usePractice } from "./PracticeProvider";

const MAX_SHOWN_ISSUES = 25;

export default function QuizImporter() {
  const router = useRouter();
  const { json, setJson, quiz, setQuiz, setSession } = usePractice();
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [level, setLevel] = useState<Level | "all">("all");
  const [count, setCount] = useState("0");
  const [seconds, setSeconds] = useState("0");
  const id = useId();

  function validate() {
    const result = validateQuizJson(json);
    if (result.ok) {
      setIssues([]);
      setQuiz(result.quiz);
      setLevel("all");
    } else {
      setQuiz(null);
      setIssues(result.issues);
    }
  }

  function start() {
    if (!quiz) return;
    setSession(startPractice(quiz, { level, count: Number(count), secondsPerQuestion: Number(seconds) }));
    router.push("/practice/play");
  }

  const levelCounts = quiz
    ? Object.fromEntries(LEVELS.map((l) => [l, quiz.questions.filter((q) => q.level === l).length]))
    : {};
  const available = quiz ? (level === "all" ? quiz.questions.length : levelCounts[level]) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card variant="solid">
        <CardHeader>
          <CardTitle>Import Quiz JSON</CardTitle>
          <CardDescription>
            Paste the JSON object ChatGPT returned. It is parsed as data only and checked against the official quiz format.
          </CardDescription>
        </CardHeader>
        <Field invalid={issues.length > 0}>
          <FieldLabel htmlFor={`${id}-json`}>Quiz JSON</FieldLabel>
          <Textarea
            id={`${id}-json`}
            value={json}
            onChange={(e) => {
              setJson(e.target.value);
              if (quiz) setQuiz(null);
            }}
            rows={20}
            spellCheck={false}
            placeholder='{ "id": "my-topic", "language": "en", "title": "…", "questions": [ … ] }'
            className="font-mono text-code"
            aria-invalid={issues.length > 0 || undefined}
            aria-describedby={issues.length ? `${id}-issues` : undefined}
          />
        </Field>
        <Button onClick={validate} variant="gradient" size="lg" disabled={!json.trim()}>
          Validate and preview
        </Button>
        {issues.length > 0 && (
          <Alert variant="destructive" id={`${id}-issues`}>
            <AlertTitle>
              {issues.length === 1 ? "1 problem" : `${issues.length} problems`} to fix. Your JSON was kept as pasted.
            </AlertTitle>
            <AlertDescription>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                {issues.slice(0, MAX_SHOWN_ISSUES).map((issue, i) => (
                  <li key={i}>
                    {issue.path && <code className="font-mono text-code">{issue.path}</code>}
                    {issue.path && ": "}
                    {issue.message}
                  </li>
                ))}
              </ul>
              {issues.length > MAX_SHOWN_ISSUES && <p className="mt-2">…and {issues.length - MAX_SHOWN_ISSUES} more.</p>}
            </AlertDescription>
          </Alert>
        )}
      </Card>

      <Card variant={quiz ? "gradient" : "solid"} className="lg:sticky lg:top-24 lg:self-start">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>{quiz ? "Valid quiz. Choose how to practice." : "Validate the JSON to see a preview."}</CardDescription>
        </CardHeader>
        {quiz && (
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 aria-hidden className="mt-1 size-5 shrink-0 text-success" />
              <div>
                {/* Imported text is rendered as plain text only. */}
                <p className="text-heading-sm text-foreground">{quiz.title}</p>
                <p className="text-body-sm text-muted-foreground">
                  Topic id <code className="font-mono">{quiz.id}</code> · {LANGUAGE_LABELS[quiz.language]}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-body-sm">
              <div>
                <dt className="text-muted-foreground">Questions</dt>
                <dd className="text-foreground">{quiz.questions.length}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Question types</dt>
                <dd className="text-foreground">{QUESTION_TYPES[0].label}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Difficulty</dt>
                <dd className="flex flex-wrap gap-1.5 pt-1">
                  {LEVELS.filter((l) => levelCounts[l] > 0).map((l) => (
                    <Badge key={l} variant="outline" size="sm">
                      {levelLabels.en[l]}: {levelCounts[l]}
                    </Badge>
                  ))}
                </dd>
              </div>
            </dl>

            <FieldSet>
              <FieldLegend variant="label">Level</FieldLegend>
              <ToggleGroup type="single" variant="outline" size="sm" value={level} onValueChange={(v) => v && setLevel(v as Level | "all")} aria-label="Level" className="flex-wrap justify-start">
                <ToggleGroupItem value="all">All levels</ToggleGroupItem>
                {LEVELS.map((l) => (
                  <ToggleGroupItem key={l} value={l} disabled={!levelCounts[l]}>
                    {levelLabels.en[l]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>
            <FieldSet>
              <FieldLegend variant="label">Questions</FieldLegend>
              <ToggleGroup type="single" variant="outline" size="sm" value={count} onValueChange={(v) => v && setCount(v)} aria-label="Questions" className="flex-wrap justify-start">
                {COUNT_OPTIONS.map((n) => (
                  <ToggleGroupItem key={n} value={String(n)} disabled={n > 0 && n >= available}>
                    {n === 0 ? `All (${available})` : n}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>
            <FieldSet>
              <FieldLegend variant="label">Time per question</FieldLegend>
              <ToggleGroup type="single" variant="outline" size="sm" value={seconds} onValueChange={(v) => v && setSeconds(v)} aria-label="Time per question" className="flex-wrap justify-start">
                {TIME_OPTIONS.map((n) => (
                  <ToggleGroupItem key={n} value={String(n)}>
                    {n === 0 ? "No limit" : `${n}s`}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>
            <Button variant="gradient" size="lg" onClick={start} disabled={available === 0}>
              <Play aria-hidden className="size-4" /> Start Practice
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
