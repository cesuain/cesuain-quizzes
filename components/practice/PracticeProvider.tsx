"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { PracticeSession } from "@/lib/practice/session";
import type { PromptRequest } from "@/lib/quiz/prompt";
import type { Quiz } from "@/lib/types";

/**
 * Custom practice state, held in memory for the /practice/* pages only. It is never sent to the
 * server or written to storage: refreshing or leaving the app discards it, by design.
 */
interface PracticeState {
  request: PromptRequest;
  setRequest: (request: PromptRequest) => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  /** Pasted JSON, kept as typed even when it is invalid. */
  json: string;
  setJson: (json: string) => void;
  quiz: Quiz | null;
  setQuiz: (quiz: Quiz | null) => void;
  session: PracticeSession | null;
  setSession: (session: PracticeSession | null) => void;
}

const PracticeContext = createContext<PracticeState | null>(null);

export const EMPTY_REQUEST: PromptRequest = {
  topic: "",
  objectives: "",
  difficulty: "mixed",
  questionCount: 10,
  language: "en",
  context: "",
  instructions: "",
};

export function PracticeProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<PromptRequest>(EMPTY_REQUEST);
  const [prompt, setPrompt] = useState("");
  const [json, setJson] = useState("");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [session, setSession] = useState<PracticeSession | null>(null);

  const value = useMemo(
    () => ({ request, setRequest, prompt, setPrompt, json, setJson, quiz, setQuiz, session, setSession }),
    [request, prompt, json, quiz, session],
  );
  return <PracticeContext.Provider value={value}>{children}</PracticeContext.Provider>;
}

export function usePractice(): PracticeState {
  const value = useContext(PracticeContext);
  if (!value) throw new Error("usePractice must be used inside PracticeProvider");
  return value;
}
