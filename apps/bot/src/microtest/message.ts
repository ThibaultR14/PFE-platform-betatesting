import type { QuestionType } from "@microbeta/db";
import { t } from "@microbeta/i18n";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { DmMessage } from "../messaging";

/** Limite Discord d'un message. */
export const DISCORD_MESSAGE_MAX = 2_000;
/** Les consignes sont coupées au-delà : le reste du message doit tenir à côté. */
export const INSTRUCTIONS_MAX = 600;
/** L'énoncé d'une question est coupé au-delà (le texte complet reste sur la page web). */
export const PROMPT_MAX = 500;
/** Un choix est coupé au-delà : c'est aussi la limite d'un libellé de bouton ou de menu Discord. */
export const OPTION_MAX = 80;
/** Nombre de choix affichés au plus : c'est aussi la limite d'un menu de sélection Discord. */
export const OPTIONS_MAX = 25;
const TITLE_MAX = 150;

/** Ce que le message a besoin de savoir d'une question. */
export interface QuestionView {
  type: QuestionType;
  prompt: string;
  /** Champ JSON `Question.options` : une liste de textes pour SINGLE et MULTI. */
  options: unknown;
  required: boolean;
}

export interface MicroTestMessageData {
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
 * Message privé qui ouvre un micro-test : titre, durée, consignes, première question, et le bouton
 * « Répondre sur le web » si le lien est disponible. Les boutons de réponse arrivent avec #25.
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
    questionContent(data.question, 1, data.questionCount),
    data.webLink ? t("bot.microtest.webHint") : null,
  ].filter((p): p is string => p !== null && p !== "");

  const components = data.webLink
    ? [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Link)
              .setURL(data.webLink)
              .setLabel(t("bot.microtest.webButton")),
          )
          .toJSON(),
      ]
    : [];

  return { content: cut(paragraphs.join("\n\n"), DISCORD_MESSAGE_MAX), components };
}

/**
 * Texte d'une question : « Question n/N », l'énoncé, et une ligne qui dit comment répondre selon
 * le type (avec la liste des choix pour SINGLE et MULTI). Réutilisé pour les questions suivantes (#25).
 */
export function questionContent(question: QuestionView, number: number, count: number): string {
  const header = t("bot.microtest.questionHeader", { number, count });
  const prompt = cut(question.prompt.trim(), PROMPT_MAX);
  const optional = question.required ? "" : ` ${t("bot.microtest.optional")}`;
  const lines = [header, `${prompt}${optional}`, `_${t(`bot.microtest.hint.${question.type}`)}_`];

  if (question.type === "SINGLE" || question.type === "MULTI") {
    parseOptions(question.options).forEach((option, i) => lines.push(`${i + 1}. ${option}`));
  }
  return lines.join("\n");
}

/** Choix d'une question SINGLE ou MULTI. Une valeur mal formée donne une liste vide. */
export function parseOptions(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options
    .filter((option): option is string => typeof option === "string" && option.trim() !== "")
    .slice(0, OPTIONS_MAX)
    .map((option) => cut(option.trim(), OPTION_MAX));
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
