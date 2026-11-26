import { t, type MessageKey } from "@microbeta/i18n";
import type { ConsentResult } from "../../welcome/consent";
import { ephemeral } from "../commands/types";
import { CONSENT_PREFIX } from "./custom-id";
import type { BotButton } from "./types";

/** Enregistre l'accord : `acceptConsent` lié à la BDD (injecté pour pouvoir tester sans BDD). */
export type AcceptConsent = (testerId: string, discordUserId: string) => Promise<ConsentResult>;

const EPHEMERAL_REPLIES: Record<Exclude<ConsentResult, "accepted">, MessageKey> = {
  alreadyAccepted: "bot.consent.alreadyAccepted",
  optedOut: "bot.consent.optedOut",
  notYou: "bot.consent.notYou",
  unknownTester: "bot.consent.unknownTester",
};

/**
 * Bouton « J'accepte de participer » du message d'accueil (`consent:<testerId>`).
 * Accord enregistré : le message d'accueil est modifié (bouton retiré, confirmation ajoutée).
 * Sinon : réponse éphémère, et le message ne change pas.
 */
export function consentButton(accept: AcceptConsent): BotButton {
  return {
    prefix: CONSENT_PREFIX,
    async execute(interaction, testerId) {
      const result = await accept(testerId, interaction.user.id);
      if (result === "accepted") {
        await interaction.update({
          content: `${interaction.message.content}\n\n${t("bot.consent.accepted")}`,
          components: [],
        });
        return;
      }
      await interaction.reply(ephemeral(t(EPHEMERAL_REPLIES[result])));
    },
  };
}
