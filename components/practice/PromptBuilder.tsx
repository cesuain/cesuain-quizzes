"use client";

import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  Input,
  Link,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
} from "@cesuain/ui";
import { ArrowRight, Check, Copy, ExternalLink, Wand2 } from "lucide-react";
import NextLink from "next/link";
import { useId, useState } from "react";
import { LANGUAGE_LABELS, levelLabels } from "@/lib/i18n";
import {
  DIFFICULTIES,
  QUESTION_COUNT_RANGE,
  QUESTION_TYPES,
  buildQuizPrompt,
  hasPromptInput,
  type Difficulty,
  type PromptExample,
} from "@/lib/quiz/prompt";
import { LANGUAGES, type Language } from "@/lib/types";
import { usePractice } from "./PracticeProvider";

const CHATGPT_URL = "https://chatgpt.com/";

export default function PromptBuilder({ example }: { example: PromptExample }) {
  const { request, setRequest, prompt, setPrompt } = usePractice();
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const [missingInput, setMissingInput] = useState(false);
  const id = useId();

  const update = <K extends keyof typeof request>(key: K, value: (typeof request)[K]) =>
    setRequest({ ...request, [key]: value });

  function generate(event: React.FormEvent) {
    event.preventDefault();
    if (!hasPromptInput(request)) {
      setMissingInput(true);
      return;
    }
    setMissingInput(false);
    setCopied("idle");
    setPrompt(buildQuizPrompt(request, example));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card variant="solid">
        <CardHeader>
          <CardTitle>Describe what you want to learn</CardTitle>
          <CardDescription>
            Fill in what helps; only a topic or free-form instructions are required.
          </CardDescription>
        </CardHeader>
        <form onSubmit={generate} noValidate>
          <FieldGroup>
            <Field invalid={missingInput}>
              <FieldLabel htmlFor={`${id}-topic`}>Topic or subject</FieldLabel>
              <Input
                id={`${id}-topic`}
                value={request.topic}
                maxLength={200}
                placeholder="e.g. PostgreSQL indexing"
                onChange={(e) => update("topic", e.target.value)}
                aria-invalid={missingInput || undefined}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-objectives`}>Concepts or learning objectives</FieldLabel>
              <Textarea
                id={`${id}-objectives`}
                value={request.objectives}
                rows={3}
                maxLength={2000}
                placeholder="e.g. B-tree vs GIN indexes, partial indexes, reading EXPLAIN output"
                onChange={(e) => update("objectives", e.target.value)}
              />
            </Field>
            <FieldSet>
              <FieldLegend variant="label">Difficulty</FieldLegend>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={request.difficulty}
                onValueChange={(v) => v && update("difficulty", v as Difficulty)}
                aria-label="Difficulty"
                className="flex-wrap justify-start"
              >
                {DIFFICULTIES.map((d) => (
                  <ToggleGroupItem key={d} value={d}>
                    {d === "mixed" ? "Mixed" : levelLabels.en[d]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${id}-count`}>Number of questions</FieldLabel>
                <Input
                  id={`${id}-count`}
                  type="number"
                  inputMode="numeric"
                  min={QUESTION_COUNT_RANGE.min}
                  max={QUESTION_COUNT_RANGE.max}
                  value={request.questionCount}
                  onChange={(e) => update("questionCount", Number(e.target.value) || QUESTION_COUNT_RANGE.min)}
                  aria-describedby={`${id}-count-hint`}
                />
                <FieldDescription id={`${id}-count-hint`}>
                  {QUESTION_COUNT_RANGE.min}–{QUESTION_COUNT_RANGE.max}.
                </FieldDescription>
              </Field>
              <FieldSet>
                <FieldLegend variant="label">Language</FieldLegend>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={request.language}
                  onValueChange={(v) => v && update("language", v as Language)}
                  aria-label="Language"
                  className="flex-wrap justify-start"
                >
                  {LANGUAGES.map((l) => (
                    <ToggleGroupItem key={l} value={l}>
                      {LANGUAGE_LABELS[l]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </FieldSet>
            </div>
            <FieldSet>
              <FieldLegend variant="label">Question types</FieldLegend>
              <ul className="flex flex-col gap-1 text-body-sm">
                {QUESTION_TYPES.map((type) => (
                  <li key={type.id}>
                    <span className="text-foreground">{type.label}</span>
                    <span className="text-muted-foreground"> — {type.description}</span>
                  </li>
                ))}
              </ul>
              <FieldDescription>The quiz format supports one question type, so it is always requested.</FieldDescription>
            </FieldSet>
            <Field>
              <FieldLabel htmlFor={`${id}-context`}>Context or source material</FieldLabel>
              <Textarea
                id={`${id}-context`}
                value={request.context}
                rows={4}
                maxLength={20000}
                placeholder="Optional: paste notes or a passage the questions should be based on."
                onChange={(e) => update("context", e.target.value)}
              />
            </Field>
            <Field invalid={missingInput}>
              <FieldLabel htmlFor={`${id}-instructions`}>Additional instructions</FieldLabel>
              <Textarea
                id={`${id}-instructions`}
                value={request.instructions}
                rows={3}
                maxLength={4000}
                placeholder="Optional, or describe everything here instead of using the fields above."
                onChange={(e) => update("instructions", e.target.value)}
              />
            </Field>
            {missingInput && (
              <Alert variant="destructive">
                <AlertDescription>Enter a topic, learning objectives or instructions first.</AlertDescription>
              </Alert>
            )}
            <Button type="submit" variant="gradient" size="lg">
              <Wand2 aria-hidden className="size-4" /> Generate Prompt
            </Button>
          </FieldGroup>
        </form>
      </Card>

      <Card variant="solid" className="lg:sticky lg:top-24 lg:self-start">
        <CardHeader>
          <CardTitle>Your ChatGPT prompt</CardTitle>
          <CardDescription>
            Copy it, open ChatGPT, paste it there and send. Then bring the JSON answer back to the import step. The app
            does not contact ChatGPT itself.
          </CardDescription>
        </CardHeader>
        {prompt ? (
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor={`${id}-prompt`}>Prompt (editable)</FieldLabel>
              <Textarea
                id={`${id}-prompt`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={18}
                spellCheck={false}
                className="font-mono text-code"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button onClick={copy} variant="gradient">
                {copied === "copied" ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
                {copied === "copied" ? "Copied" : "Copy Prompt"}
              </Button>
              <Button asChild variant="outline">
                <a href={CHATGPT_URL} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden className="size-4" /> Open ChatGPT
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </Button>
              <Button asChild variant="ghost">
                <NextLink href="/practice/import">
                  I have the JSON <ArrowRight aria-hidden className="size-4" />
                </NextLink>
              </Button>
            </div>
            <p role="status" className="text-body-sm text-muted-foreground">
              {copied === "copied" && "Prompt copied to the clipboard."}
              {copied === "failed" && "Could not access the clipboard. Select the text above and copy it manually."}
            </p>
          </div>
        ) : (
          <p className="text-body-sm text-muted-foreground">
            Fill in the form and choose <strong>Generate Prompt</strong>. The prompt asks for JSON in exactly the format of
            the official quizzes, so the answer can be imported as is. Already have JSON?{" "}
            <Link asChild>
              <NextLink href="/practice/import">Import it</NextLink>
            </Link>
            .
          </p>
        )}
      </Card>
    </div>
  );
}
