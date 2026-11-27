import type { PrismaClient } from "@microbeta/db";
import type { DmSender } from "../../messaging";
import { recordAnswer } from "../../microtest/answer";
import { testerWebLink, type WebLinkConfig } from "../../microtest/web-link";
import { acceptConsent } from "../../welcome/consent";
import {
  answerButton,
  pickSelect,
  skipButton,
  textModal,
  writeButton,
  type AnswerDeps,
} from "../answers/handlers";
import { consentButton } from "./consent";
import type { BotButton, BotModal, BotSelect } from "./types";

export type {
  BotButton,
  BotModal,
  BotSelect,
  ButtonInteraction,
  ComponentHandler,
  ComponentInteraction,
  MessageUpdate,
  ModalInteraction,
  SelectInteraction,
} from "./types";

/** Tous les composants du bot : boutons, menus de sélection et fenêtres de saisie. */
export interface BotComponents {
  buttons: readonly BotButton[];
  selects: readonly BotSelect[];
  modals: readonly BotModal[];
}

/**
 * Contrairement aux commandes, les composants ont besoin de la BDD, du lien web et d'un `DmSender`
 * (pour envoyer la question suivante en message privé).
 */
export function createComponents({
  prisma,
  dm,
  ...webLink
}: { prisma: PrismaClient; dm: DmSender } & WebLinkConfig): BotComponents {
  const answers: AnswerDeps = {
    record: (request) => recordAnswer(prisma, request),
    webLink: (testerId, assignmentId) => testerWebLink(webLink, testerId, assignmentId),
    dm,
  };
  return {
    buttons: [
      consentButton((testerId, discordUserId) => acceptConsent(prisma, testerId, discordUserId)),
      answerButton(answers),
      skipButton(answers),
      writeButton(),
    ],
    selects: [pickSelect(answers)],
    modals: [textModal(answers)],
  };
}

/** Indexe des handlers par préfixe. Deux handlers du même préfixe sont une erreur de code. */
export function componentMap<H extends { prefix: string }>(
  list: readonly H[],
): ReadonlyMap<string, H> {
  const map = new Map<string, H>();
  for (const handler of list) {
    if (map.has(handler.prefix)) {
      throw new Error(`Composant déclaré deux fois : ${handler.prefix}`);
    }
    map.set(handler.prefix, handler);
  }
  return map;
}
