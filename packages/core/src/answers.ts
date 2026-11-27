import { activeInOrder, type Ordered } from "./order";

/** Types de question (enum `QuestionType` du schéma). */
export type QuestionKind = "TEXT" | "RATING" | "SINGLE" | "MULTI" | "YESNO";

export const RATING_MIN = 1;
export const RATING_MAX = 5;
/** Nombre de choix au plus : c'est aussi la limite d'un menu de sélection Discord. */
export const OPTIONS_MAX = 25;
/** Longueur maximale d'une réponse libre : c'est aussi la limite d'une fenêtre de saisie Discord. */
export const TEXT_ANSWER_MAX = 4_000;

/** Ce que la vérification d'une réponse a besoin de savoir d'une question. */
export interface AnswerableQuestion {
  type: QuestionKind;
  prompt: string;
  /** Champ JSON `Question.options` : une liste de textes pour SINGLE et MULTI. */
  options: unknown;
  required: boolean;
  version: number;
}

/**
 * Réponse reçue, avant vérification. Les choix sont désignés par leur numéro dans
 * `questionOptions(question.options)`, qui est la liste affichée au testeur.
 */
export type AnswerInput =
  | { kind: "text"; text: string }
  | { kind: "rating"; rating: number }
  | { kind: "yesno"; yes: boolean }
  | { kind: "choice"; index: number }
  | { kind: "choices"; indexes: readonly number[] }
  | { kind: "skip" };

/**
 * Valeur enregistrée dans `Answer.value` : TEXT `string`, RATING `number`, YESNO `boolean`,
 * SINGLE `string` (le texte du choix), MULTI `string[]`. `null` : question facultative passée.
 */
export type AnswerValue = string | number | boolean | string[] | null;

/**
 * Pourquoi une réponse est refusée :
 * - `wrongKind` : la réponse ne correspond pas au type de la question (ancien bouton…) ;
 * - `required` : réponse vide ou question passée, alors qu'elle est obligatoire ;
 * - `outOfRange` : note hors de 1–5, ou choix qui n'existe pas ;
 * - `tooLong` : texte de plus de `TEXT_ANSWER_MAX` caractères.
 */
export type AnswerError = "wrongKind" | "required" | "outOfRange" | "tooLong";

export type ParsedAnswer = { ok: true; value: AnswerValue } | { ok: false; error: AnswerError };

/** Copie de la question telle que posée, gardée dans `Answer.questionSnapshot`. */
export type QuestionSnapshot = {
  type: QuestionKind;
  prompt: string;
  /** Les choix affichés (SINGLE et MULTI), `null` pour les autres types. */
  options: string[] | null;
  version: number;
};

/**
 * Choix d'une question SINGLE ou MULTI, tels qu'ils sont affichés et numérotés : textes non vides,
 * sans espaces autour, `OPTIONS_MAX` au plus. Une valeur mal formée donne une liste vide.
 */
export function questionOptions(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options
    .filter((option): option is string => typeof option === "string" && option.trim() !== "")
    .map((option) => option.trim())
    .slice(0, OPTIONS_MAX);
}

export function questionSnapshot(question: AnswerableQuestion): QuestionSnapshot {
  const hasOptions = question.type === "SINGLE" || question.type === "MULTI";
  return {
    type: question.type,
    prompt: question.prompt,
    options: hasOptions ? questionOptions(question.options) : null,
    version: question.version,
  };
}

/** Vérifie une réponse et donne la valeur à enregistrer (voir `AnswerValue`). */
export function parseAnswer(question: AnswerableQuestion, input: AnswerInput): ParsedAnswer {
  if (input.kind === "skip") return empty(question);

  switch (question.type) {
    case "TEXT": {
      if (input.kind !== "text") return refuse("wrongKind");
      const text = input.text.trim();
      if (text === "") return empty(question);
      if (text.length > TEXT_ANSWER_MAX) return refuse("tooLong");
      return accept(text);
    }
    case "RATING": {
      if (input.kind !== "rating") return refuse("wrongKind");
      const { rating } = input;
      if (!Number.isInteger(rating) || rating < RATING_MIN || rating > RATING_MAX) {
        return refuse("outOfRange");
      }
      return accept(rating);
    }
    case "YESNO":
      return input.kind === "yesno" ? accept(input.yes) : refuse("wrongKind");
    case "SINGLE": {
      // Un menu de sélection à un seul choix renvoie une liste d'un élément.
      const indexes =
        input.kind === "choice" ? [input.index] : input.kind === "choices" ? input.indexes : null;
      if (indexes === null) return refuse("wrongKind");
      if (indexes.length === 0) return empty(question);
      if (indexes.length > 1) return refuse("outOfRange");
      const chosen = pick(questionOptions(question.options), indexes);
      return chosen ? accept(chosen[0] ?? "") : refuse("outOfRange");
    }
    case "MULTI": {
      if (input.kind !== "choices") return refuse("wrongKind");
      if (input.indexes.length === 0) return empty(question);
      const chosen = pick(questionOptions(question.options), input.indexes);
      return chosen ? accept(chosen) : refuse("outOfRange");
    }
  }
}

/** Ce que le calcul de la question suivante a besoin de savoir d'une question. */
export type OrderedQuestion = Ordered;

export interface QuestionStep<T> {
  question: T;
  /** Rang de la question parmi les questions actives, à partir de 0 (`currentQuestionIdx`). */
  index: number;
  /** Numéro affiché, à partir de 1. */
  number: number;
  /** Nombre de questions actives du micro-test. */
  count: number;
}

/**
 * Question à poser maintenant : la première question non archivée (ordre `position`, puis `id`)
 * qui n'a pas encore de réponse. `null` quand tout est répondu.
 * Se fier aux réponses enregistrées, plutôt qu'à un compteur, résiste aux réponses venues de la
 * page web et aux questions ajoutées ou archivées en cours de route.
 */
export function nextQuestion<T extends OrderedQuestion>(
  questions: readonly T[],
  answeredIds: ReadonlySet<string>,
): QuestionStep<T> | null {
  const active = activeInOrder(questions);
  const index = active.findIndex((question) => !answeredIds.has(question.id));
  const question = active[index];
  if (!question) return null;
  return { question, index, number: index + 1, count: active.length };
}

/** Textes des choix désignés, sans doublon et dans l'ordre de la question. `null` si l'un n'existe pas. */
function pick(options: readonly string[], indexes: readonly number[]): string[] | null {
  const unique = [...new Set(indexes)].sort((a, b) => a - b);
  if (unique.some((i) => !Number.isInteger(i) || i < 0 || i >= options.length)) return null;
  return unique.map((i) => options[i] ?? "");
}

/** Pas de réponse : acceptée (`null`) pour une question facultative, refusée sinon. */
function empty(question: AnswerableQuestion): ParsedAnswer {
  return question.required ? refuse("required") : accept(null);
}

function accept(value: AnswerValue): ParsedAnswer {
  return { ok: true, value };
}

function refuse(error: AnswerError): ParsedAnswer {
  return { ok: false, error };
}
