import { TEXT_ANSWER_MAX, type AnswerInput } from "@microbeta/core";
import { t, type MessageKey } from "@microbeta/i18n";
import {
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type APIModalInteractionResponseCallbackData,
} from "discord.js";
import type { DmSender } from "../../messaging";
import type { AfterAnswer, AnswerRequest, RecordAnswerResult } from "../../microtest/answer";
import {
  answeredContent,
  buildQuestionMessage,
  completionContent,
  staleContent,
} from "../../microtest/message";
import type { BotButton, BotModal, BotSelect, ComponentInteraction } from "../buttons/types";
import { ephemeral } from "../commands/types";
import {
  ANSWER_PREFIX,
  parseAnswerArg,
  parseQuestionRef,
  PICK_PREFIX,
  SKIP_PREFIX,
  TEXT_INPUT_ID,
  TEXT_MODAL_PREFIX,
  textModalId,
  WRITE_PREFIX,
  type QuestionRef,
} from "./custom-id";

/** Enregistre une réponse : `recordAnswer` lié à la BDD (injecté pour pouvoir tester sans BDD). */
export type RecordAnswer = (request: AnswerRequest) => Promise<RecordAnswerResult>;
/** Lien signé « Répondre sur le web » pour cet assignment, `null` s'il n'est pas configuré. */
export type WebLink = (testerId: string, assignmentId: string) => Promise<string | null>;

export interface AnswerDeps {
  record: RecordAnswer;
  webLink: WebLink;
  /** Envoie la question suivante et le message de fin, en message privé normal. */
  dm: DmSender;
  now?: () => Date;
}

/** Réponse éphémère quand rien n'est enregistré. */
const EPHEMERAL_REPLIES: Record<
  Exclude<RecordAnswerResult["status"], "recorded" | "stale">,
  MessageKey
> = {
  alreadyAnswered: "bot.answer.alreadyAnswered",
  alreadyCompleted: "bot.answer.alreadyCompleted",
  notSent: "bot.answer.unknown",
  optedOut: "bot.answer.optedOut",
  notYou: "bot.answer.notYou",
  unknownAssignment: "bot.answer.unknown",
  invalid: "bot.answer.invalid",
};

/** Boutons de réponse (note, oui/non, choix) : `ans:<question>:<valeur>`. */
export function answerButton(deps: AnswerDeps): BotButton {
  return {
    prefix: ANSWER_PREFIX,
    async execute(interaction, arg) {
      const parsed = parseAnswerArg(arg);
      await respond(interaction, deps, parsed?.ref ?? null, parsed?.input ?? null);
    },
  };
}

/** Bouton « Passer » d'une question facultative. */
export function skipButton(deps: AnswerDeps): BotButton {
  return {
    prefix: SKIP_PREFIX,
    async execute(interaction, arg) {
      await respond(interaction, deps, parseQuestionRef(arg), { kind: "skip" });
    },
  };
}

/**
 * Bouton « Répondre » d'une question TEXT : ouvre la fenêtre de saisie. Rien n'est lu en BDD, car
 * la fenêtre doit être la toute première réponse à l'interaction. On vérifie tout à l'envoi.
 */
export function writeButton(): BotButton {
  return {
    prefix: WRITE_PREFIX,
    async execute(interaction, arg) {
      const ref = parseQuestionRef(arg);
      if (!ref) {
        await interaction.reply(ephemeral(t("bot.errors.unknownButton")));
        return;
      }
      await interaction.showModal(textAnswerModal(ref));
    },
  };
}

/** Menu de sélection (MULTI, et SINGLE au-delà de 5 choix) : les valeurs sont les numéros des choix. */
export function pickSelect(deps: AnswerDeps): BotSelect {
  return {
    prefix: PICK_PREFIX,
    async execute(interaction, arg) {
      // Un numéro mal formé donne NaN, refusé par `core.parseAnswer`.
      const indexes = interaction.values.map(Number);
      await respond(interaction, deps, parseQuestionRef(arg), { kind: "choices", indexes });
    },
  };
}

/** Fenêtre de saisie envoyée (question TEXT). */
export function textModal(deps: AnswerDeps): BotModal {
  return {
    prefix: TEXT_MODAL_PREFIX,
    async execute(interaction, arg) {
      const text = interaction.fields.getTextInputValue(TEXT_INPUT_ID);
      await respond(interaction, deps, parseQuestionRef(arg), { kind: "text", text });
    },
  };
}

/** Fenêtre de saisie d'une réponse libre. */
export function textAnswerModal(ref: QuestionRef): APIModalInteractionResponseCallbackData {
  return new ModalBuilder()
    .setCustomId(textModalId(ref))
    .setTitle(t("bot.answer.modalTitle"))
    .addLabelComponents(
      new LabelBuilder()
        .setLabel(t("bot.answer.modalLabel"))
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(TEXT_INPUT_ID)
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(TEXT_ANSWER_MAX),
        ),
    )
    .toJSON();
}

/**
 * Enregistre la réponse, puis :
 * - réponse enregistrée : le message de la question perd ses boutons et rappelle la réponse, puis
 *   la question suivante (ou le message de fin) part dans un nouveau message privé ;
 * - question modifiée depuis l'envoi : le message perd ses boutons, la question à jour est reposée ;
 * - sinon (déjà répondu, micro-test terminé…) : réponse éphémère, rien ne change.
 */
async function respond(
  interaction: ComponentInteraction,
  deps: AnswerDeps,
  ref: QuestionRef | null,
  input: AnswerInput | null,
): Promise<void> {
  if (!ref || !input) {
    await interaction.reply(ephemeral(t("bot.errors.unknownButton")));
    return;
  }
  const result = await deps.record({ ...ref, discordUserId: interaction.user.id, input });
  const original = interaction.message.content;

  switch (result.status) {
    case "recorded":
      await interaction.update({
        content: answeredContent(original, result.value),
        components: [],
      });
      await sendNext(interaction, deps, ref.assignmentId, result.testerId, result.then);
      return;
    case "stale":
      await interaction.update({ content: staleContent(original), components: [] });
      await sendNext(interaction, deps, ref.assignmentId, result.testerId, result.then);
      return;
    default:
      await interaction.reply(ephemeral(t(EPHEMERAL_REPLIES[result.status])));
  }
}

/**
 * Nouveau message privé : la question suivante, ou la fin du micro-test. Il passe par le
 * `DmSender`, comme l'intro du micro-test : envoyé en suite de l'interaction (`followUp`), Discord
 * l'afficherait comme une réponse, avec un aperçu de la question précédente au-dessus.
 * S'il échoue, la réponse reste enregistrée : les relances (#26) reposeront la question en cours.
 */
async function sendNext(
  interaction: ComponentInteraction,
  deps: AnswerDeps,
  assignmentId: string,
  testerId: string,
  then: AfterAnswer,
): Promise<void> {
  const to = interaction.user.id;
  if (then.kind === "completed") {
    const now = deps.now?.() ?? new Date();
    await deps.dm.send(to, { content: completionContent(then.nextAt, now), components: [] });
    return;
  }
  const { question, number, count } = then.step;
  const webLink = await deps.webLink(testerId, assignmentId);
  await deps.dm.send(to, buildQuestionMessage({ assignmentId, question, number, count, webLink }));
}
