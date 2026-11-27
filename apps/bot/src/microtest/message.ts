import { hoursBetween, questionOptions, type AnswerValue } from "@microbeta/core";
import type { QuestionType } from "@microbeta/db";
import { t } from "@microbeta/i18n";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type APIActionRowComponent,
  type APIComponentInMessageActionRow,
} from "discord.js";
import {
  answerButtonId,
  choiceToken,
  NO_TOKEN,
  pickMenuId,
  ratingToken,
  skipButtonId,
  writeButtonId,
  YES_TOKEN,
  type QuestionRef,
} from "../discord/answers/custom-id";
import type { DmMessage } from "../messaging";

/** Limite Discord d'un message. */
export const DISCORD_MESSAGE_MAX = 2_000;
/** Les consignes sont coupées au-delà : le reste du message doit tenir à côté. */
export const INSTRUCTIONS_MAX = 600;
/** L'énoncé d'une question est coupé au-delà (le texte complet reste sur la page web). */
export const PROMPT_MAX = 500;
/** Un choix est coupé au-delà : c'est aussi la limite d'un libellé de bouton ou de menu Discord. */
export const OPTION_MAX = 80;
/** Jusqu'à ce nombre de choix, une question SINGLE a un bouton par choix (une rangée), au-delà un menu. */
export const SINGLE_BUTTONS_MAX = 5;
/** Une réponse rappelée sous la question est coupée au-delà. */
export const ANSWER_SHOWN_MAX = 300;
const TITLE_MAX = 150;

type ActionRow = APIActionRowComponent<APIComponentInMessageActionRow>;

/** Ce que le message a besoin de savoir d'une question. */
export interface QuestionView {
  id: string;
  type: QuestionType;
  prompt: string;
  /** Champ JSON `Question.options` : une liste de textes pour SINGLE et MULTI. */
  options: unknown;
  required: boolean;
  version: number;
}

export interface QuestionMessageData {
  assignmentId: string;
  question: QuestionView;
  /** Numéro de la question (à partir de 1) et nombre de questions actives du micro-test. */
  number: number;
  count: number;
  /** URL signée de la page web testeur, `null` si le lien n'est pas configuré. */
  webLink: string | null;
}

export interface MicroTestMessageData {
  assignmentId: string;
  title: string;
  instructions: string | null;
  estimatedMinutes: number;
  /** Nombre de questions actives du micro-test. */
  questionCount: number;
  /** La première question, posée dans ce message. */
  question: QuestionView;
  /** URL signée de la page web testeur, `null` si le lien n'est pas configuré. */
  webLink: string | null;
}

/**
 * Message privé qui ouvre un micro-test : titre, durée, consignes, première question avec ses
 * boutons de réponse, et le bouton « Répondre sur le web » si le lien est disponible.
 */
export function buildMicroTestMessage(data: MicroTestMessageData): DmMessage {
  const header = [
    t("bot.microtest.title", { title: cut(data.title.trim(), TITLE_MAX) }),
    data.questionCount === 1
      ? t("bot.microtest.durationOne", { minutes: data.estimatedMinutes })
      : t("bot.microtest.durationMany", {
          minutes: data.estimatedMinutes,
          count: data.questionCount,
        }),
  ].join("\n");

  const paragraphs = [
    header,
    quote(data.instructions),
    t("bot.microtest.buttonsOnly"),
    questionContent(data.question, 1, data.questionCount),
    data.webLink ? t("bot.microtest.webHint") : null,
  ].filter((p): p is string => p !== null && p !== "");

  return {
    content: cut(paragraphs.join("\n\n"), DISCORD_MESSAGE_MAX),
    components: questionComponents(data.assignmentId, data.question, data.webLink),
  };
}

/** Message d'une question suivante (la 2e, la 3e…), avec ses boutons de réponse. */
export function buildQuestionMessage(data: QuestionMessageData): DmMessage {
  return {
    content: cut(questionContent(data.question, data.number, data.count), DISCORD_MESSAGE_MAX),
    components: questionComponents(data.assignmentId, data.question, data.webLink),
  };
}

/**
 * Texte d'une question : « Question n/N », l'énoncé, et une ligne qui dit comment répondre selon
 * le type (avec la liste des choix pour SINGLE et MULTI).
 */
export function questionContent(question: QuestionView, number: number, count: number): string {
  const header = t("bot.microtest.questionHeader", { number, count });
  const prompt = cut(question.prompt.trim(), PROMPT_MAX);
  const optional = question.required ? "" : ` ${t("bot.microtest.optional")}`;
  const lines = [header, `${prompt}${optional}`, `_${t(`bot.microtest.hint.${question.type}`)}_`];

  if (question.type === "SINGLE" || question.type === "MULTI") {
    displayOptions(question.options).forEach((option, i) => lines.push(`${i + 1}. ${option}`));
  }
  return lines.join("\n");
}

/**
 * Rangées de composants sous une question :
 * - de quoi répondre : 5 boutons (RATING), Oui/Non (YESNO), un bouton par choix ou un menu (SINGLE),
 *   un menu (MULTI), un bouton qui ouvre la fenêtre de saisie (TEXT) ;
 * - puis « Passer » si la question est facultative, et « Répondre sur le web » si le lien existe.
 */
export function questionComponents(
  assignmentId: string,
  question: QuestionView,
  webLink: string | null,
): ActionRow[] {
  const ref: QuestionRef = { assignmentId, questionId: question.id, version: question.version };
  const rows: ActionRow[] = [];
  const answer = answerRow(ref, question);
  if (answer) rows.push(answer);

  const extra: ButtonBuilder[] = [];
  if (!question.required) {
    extra.push(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(skipButtonId(ref))
        .setLabel(t("bot.answer.skip")),
    );
  }
  if (webLink) {
    extra.push(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setURL(webLink)
        .setLabel(t("bot.microtest.webButton")),
    );
  }
  if (extra.length > 0) rows.push(buttonRow(extra));
  return rows;
}

/**
 * Contenu du message d'une question après la réponse : le texte d'origine, puis la réponse.
 * Le texte d'origine est coupé si besoin, pour que la réponse reste visible.
 */
export function answeredContent(original: string, value: AnswerValue): string {
  return withNote(original, answerText(value));
}

/** Contenu du message d'une question modifiée depuis l'envoi : le texte d'origine, puis l'avertissement. */
export function staleContent(original: string): string {
  return withNote(original, t("bot.answer.stale"));
}

/** Rappel de la réponse enregistrée. `null` : question passée. */
export function answerText(value: AnswerValue): string {
  if (value === null) return t("bot.answer.skipped");
  let shown: string;
  if (typeof value === "boolean") shown = t(value ? "bot.answer.yes" : "bot.answer.no");
  else if (typeof value === "number") shown = t("bot.answer.rating", { rating: value });
  else if (Array.isArray(value)) shown = value.join(", ");
  else shown = value;
  return t("bot.answer.recorded", { value: cut(shown.replace(/\s+/g, " "), ANSWER_SHOWN_MAX) });
}

/**
 * Message de fin de micro-test : merci, puis quand arrive le suivant.
 * `nextAt` vaut `null` s'il n'y en a pas (dernier micro-test, ou suivant après la date limite).
 */
export function completionContent(nextAt: Date | null, now: Date): string {
  if (!nextAt) return `${t("bot.answer.completed")}\n${t("bot.answer.last")}`;
  const hours = hoursBetween(now, nextAt);
  const next =
    hours < 1 ? t("bot.answer.nextSoon") : t("bot.answer.nextIn", { delay: formatDelay(hours) });
  return `${t("bot.answer.completed")}\n${next}`;
}

/** Délai arrondi, en heures sous un jour, en jours au-delà. */
export function formatDelay(hours: number): string {
  const h = Math.max(1, Math.round(hours));
  if (h < 24)
    return h === 1 ? t("bot.answer.delay.hour") : t("bot.answer.delay.hours", { count: h });
  const days = Math.round(h / 24);
  return days === 1 ? t("bot.answer.delay.day") : t("bot.answer.delay.days", { count: days });
}

/** Choix d'une question SINGLE ou MULTI, tels qu'affichés : numérotés comme dans `core`, coupés. */
export function displayOptions(options: unknown): string[] {
  return questionOptions(options).map((option) => cut(option, OPTION_MAX));
}

function answerRow(ref: QuestionRef, question: QuestionView): ActionRow | null {
  switch (question.type) {
    case "RATING":
      return buttonRow(
        [1, 2, 3, 4, 5].map((rating) =>
          answerButton(answerButtonId(ref, ratingToken(rating)), String(rating)),
        ),
      );
    case "YESNO":
      return buttonRow([
        answerButton(answerButtonId(ref, YES_TOKEN), t("bot.answer.yes")),
        answerButton(answerButtonId(ref, NO_TOKEN), t("bot.answer.no")),
      ]);
    case "TEXT":
      return buttonRow([answerButton(writeButtonId(ref), t("bot.answer.write"))]);
    case "SINGLE": {
      const options = displayOptions(question.options);
      if (options.length === 0) return null;
      if (options.length <= SINGLE_BUTTONS_MAX) {
        return buttonRow(
          options.map((option, i) => answerButton(answerButtonId(ref, choiceToken(i)), option)),
        );
      }
      return selectRow(ref, options, 1);
    }
    case "MULTI": {
      const options = displayOptions(question.options);
      return options.length === 0 ? null : selectRow(ref, options, options.length);
    }
  }
}

function answerButton(customId: string, label: string): ButtonBuilder {
  return new ButtonBuilder().setStyle(ButtonStyle.Primary).setCustomId(customId).setLabel(label);
}

function buttonRow(buttons: ButtonBuilder[]): ActionRow {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons).toJSON();
}

/** Menu de sélection : la valeur de chaque choix est son numéro, traduit en texte par `core`. */
function selectRow(ref: QuestionRef, options: string[], maxValues: number): ActionRow {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(pickMenuId(ref))
    .setPlaceholder(t(maxValues === 1 ? "bot.answer.pickOne" : "bot.answer.pickMany"))
    .setMinValues(1)
    .setMaxValues(maxValues)
    .addOptions(options.map((label, i) => ({ label, value: String(i) })));
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu).toJSON();
}

function withNote(original: string, note: string): string {
  return `${cut(original, DISCORD_MESSAGE_MAX - note.length - 2)}\n\n${note}`;
}

/** Consignes en citation Discord (`> ` devant chaque ligne), coupées si elles sont trop longues. */
function quote(text: string | null): string | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  return cut(trimmed, INSTRUCTIONS_MAX)
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

/** Coupe un texte à `max` caractères, points de suspension compris. */
function cut(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
