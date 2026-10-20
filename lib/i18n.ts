import type { Language, Level } from "./types";

/** Strings of the quiz player, shown in the language of the quiz being played. */
const strings = {
  en: {
    question: (i: number, n: number) => `Question ${i} of ${n}`,
    questionShort: (i: number) => `Question ${i}`,
    next: "Next question",
    finish: "See results",
    timeUp: "Time's up!",
    correct: "Correct!",
    wrong: "Not quite. Try again.",
    revealed: "Here is the answer.",
    reveal: "Show answer",
    explanation: "Why",
    correctAnswer: "Correct answer",
    keyboardHint: "Tip: press 1–4 to answer and Enter to continue.",
    secondsLeft: (n: number) => `${n} seconds left`,
    outcome: { pending: "not answered yet", correct: "correct", revealed: "answer revealed", timed_out: "timed out" },
    questionNavigation: "Questions",
  },
  "pt-br": {
    question: (i: number, n: number) => `Pergunta ${i} de ${n}`,
    questionShort: (i: number) => `Pergunta ${i}`,
    next: "Próxima pergunta",
    finish: "Ver resultado",
    timeUp: "Tempo esgotado!",
    correct: "Correto!",
    wrong: "Não foi dessa vez. Tente de novo.",
    revealed: "Esta é a resposta.",
    reveal: "Mostrar resposta",
    explanation: "Por quê",
    correctAnswer: "Resposta correta",
    keyboardHint: "Dica: use as teclas 1–4 para responder e Enter para continuar.",
    secondsLeft: (n: number) => `${n} segundos restantes`,
    outcome: { pending: "ainda não respondida", correct: "correta", revealed: "resposta revelada", timed_out: "tempo esgotado" },
    questionNavigation: "Perguntas",
  },
} satisfies Record<Language, unknown>;

export type Strings = (typeof strings)["en"];

export function t(language: Language): Strings {
  return strings[language];
}

export const levelLabels: Record<Language, Record<Level, string>> = {
  en: { basic: "Basic", intermediate: "Intermediate", advanced: "Advanced" },
  "pt-br": { basic: "Básico", intermediate: "Intermediário", advanced: "Avançado" },
};

export const LANGUAGE_LABELS: Record<Language, string> = { en: "English", "pt-br": "Português (BR)" };
