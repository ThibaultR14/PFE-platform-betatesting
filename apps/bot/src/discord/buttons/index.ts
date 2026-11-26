import type { PrismaClient } from "@microbeta/db";
import { acceptConsent } from "../../welcome/consent";
import { consentButton } from "./consent";
import type { BotButton } from "./types";

export type { BotButton, ButtonInteraction, MessageUpdate } from "./types";

/** Tous les boutons du bot. Contrairement aux commandes, ils ont besoin de la BDD. */
export function createButtons({ prisma }: { prisma: PrismaClient }): readonly BotButton[] {
  return [
    consentButton((testerId, discordUserId) => acceptConsent(prisma, testerId, discordUserId)),
  ];
}

/** Indexe les boutons par préfixe. Deux boutons du même préfixe sont une erreur de code. */
export function buttonMap(list: readonly BotButton[]): ReadonlyMap<string, BotButton> {
  const map = new Map<string, BotButton>();
  for (const button of list) {
    if (map.has(button.prefix)) {
      throw new Error(`Bouton déclaré deux fois : ${button.prefix}`);
    }
    map.set(button.prefix, button);
  }
  return map;
}
