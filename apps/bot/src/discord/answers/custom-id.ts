import type { AnswerInput } from "@microbeta/core";
import { customId } from "../buttons/custom-id";

/**
 * `customId` des composants qui répondent à une question :
 * `<préfixe>:<assignmentId>:<questionId>:<version>[:<valeur>]`, moins de 70 caractères avec des
 * cuid (Discord en accepte 100). La version repère une question modifiée entre l'envoi et le clic.
 */
export const ANSWER_PREFIX = "ans";
export const SKIP_PREFIX = "skip";
/** Bouton « Répondre » d'une question TEXT : il ouvre la fenêtre de saisie. */
export const WRITE_PREFIX = "text";
/** Menu de sélection (MULTI, et SINGLE au-delà de 5 choix). */
export const PICK_PREFIX = "pick";
/** Fenêtre de saisie envoyée. */
export const TEXT_MODAL_PREFIX = "textm";

/** Identifiant du champ de la fenêtre de saisie. */
export const TEXT_INPUT_ID = "answer";

/** La question visée : l'assignment, la question et la version affichée au testeur. */
export interface QuestionRef {
  assignmentId: string;
  questionId: string;
  version: number;
}

const SEPARATOR = ":";

/** Valeur portée par un bouton de réponse : `r<note>`, `yes`, `no` ou `c<numéro du choix>`. */
export const ratingToken = (rating: number): string => `r${rating}`;
export const choiceToken = (index: number): string => `c${index}`;
export const YES_TOKEN = "yes";
export const NO_TOKEN = "no";

const refArg = ({ assignmentId, questionId, version }: QuestionRef): string =>
  [assignmentId, questionId, version].join(SEPARATOR);

export const answerButtonId = (ref: QuestionRef, token: string): string =>
  customId(ANSWER_PREFIX, `${refArg(ref)}${SEPARATOR}${token}`);
export const skipButtonId = (ref: QuestionRef): string => customId(SKIP_PREFIX, refArg(ref));
export const writeButtonId = (ref: QuestionRef): string => customId(WRITE_PREFIX, refArg(ref));
export const pickMenuId = (ref: QuestionRef): string => customId(PICK_PREFIX, refArg(ref));
export const textModalId = (ref: QuestionRef): string => customId(TEXT_MODAL_PREFIX, refArg(ref));

/** Décode `<assignmentId>:<questionId>:<version>`. `null` si l'argument est mal formé. */
export function parseQuestionRef(arg: string): QuestionRef | null {
  const parts = arg.split(SEPARATOR);
  if (parts.length !== 3) return null;
  return refFrom(parts);
}

/** Décode l'argument d'un bouton de réponse. `null` s'il est mal formé. */
export function parseAnswerArg(arg: string): { ref: QuestionRef; input: AnswerInput } | null {
  const parts = arg.split(SEPARATOR);
  if (parts.length !== 4) return null;
  const ref = refFrom(parts.slice(0, 3));
  const input = tokenInput(parts[3] ?? "");
  return ref && input ? { ref, input } : null;
}

function refFrom([assignmentId = "", questionId = "", version = ""]: string[]): QuestionRef | null {
  if (assignmentId === "" || questionId === "" || !/^\d+$/.test(version)) return null;
  return { assignmentId, questionId, version: Number(version) };
}

function tokenInput(token: string): AnswerInput | null {
  if (token === YES_TOKEN) return { kind: "yesno", yes: true };
  if (token === NO_TOKEN) return { kind: "yesno", yes: false };
  const match = /^([rc])(\d+)$/.exec(token);
  if (!match) return null;
  const n = Number(match[2]);
  return match[1] === "r" ? { kind: "rating", rating: n } : { kind: "choice", index: n };
}
