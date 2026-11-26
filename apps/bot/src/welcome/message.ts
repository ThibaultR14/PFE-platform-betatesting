import type { DurationSummary } from "@microbeta/core";
import { t } from "@microbeta/i18n";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { consentButtonId } from "../discord/buttons/custom-id";
import type { DmMessage } from "../messaging";

/** Chemin de la page de confidentialité sur le site (à garder aligné avec `apps/web`). */
export const PRIVACY_PATH = "/confidentialite";

/** Le mot du porteur est coupé au-delà : un message Discord est limité à 2 000 caractères. */
export const WELCOME_NOTE_MAX = 800;

export interface WelcomeData {
  testerId: string;
  campaignName: string;
  ownerName: string;
  /** Mot d'accueil écrit par le porteur. */
  welcomeMessage: string | null;
  productUrl: string | null;
  duration: DurationSummary;
  /** URL publique du site (`PUBLIC_WEB_URL`), `null` si elle n'est pas configurée. */
  webUrl: string | null;
}

/**
 * Message privé d'accueil : qui écrit, pour quelle campagne, combien de temps ça prend, les liens
 * utiles, puis le bouton d'accord. Les lignes sans donnée (pas de lien produit…) sont omises.
 */
export function buildWelcomeMessage(data: WelcomeData): DmMessage {
  const paragraphs = [
    t("bot.welcome.intro", {
      appName: t("app.name"),
      ownerName: data.ownerName,
      campaignName: data.campaignName,
    }),
    quote(data.welcomeMessage),
    durationLine(data.duration),
    links(data),
    t("bot.welcome.callToAction"),
  ].filter((p): p is string => p !== null && p !== "");

  const button = new ButtonBuilder()
    .setCustomId(consentButtonId(data.testerId))
    .setLabel(t("bot.welcome.button"))
    .setStyle(ButtonStyle.Success);

  return {
    content: paragraphs.join("\n\n"),
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button).toJSON()],
  };
}

/** Mot du porteur en citation Discord (`> ` devant chaque ligne), coupé s'il est trop long. */
function quote(note: string | null): string | null {
  const text = note?.trim();
  if (!text) return null;
  const short =
    text.length > WELCOME_NOTE_MAX ? `${text.slice(0, WELCOME_NOTE_MAX).trimEnd()}…` : text;
  return short
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function durationLine({ count, minutesPerTest }: DurationSummary): string | null {
  if (count === 0) return null;
  if (count === 1) return t("bot.welcome.durationOne", { minutes: minutesPerTest });
  return t("bot.welcome.durationMany", { count, minutes: minutesPerTest });
}

function links({ productUrl, webUrl }: WelcomeData): string {
  const lines: string[] = [];
  if (productUrl) lines.push(t("bot.welcome.product", { url: noEmbed(productUrl) }));
  if (webUrl) lines.push(t("bot.welcome.privacy", { url: noEmbed(`${webUrl}${PRIVACY_PATH}`) }));
  return lines.join("\n");
}

/** `<url>` : Discord affiche le lien sans en générer l'aperçu, qui alourdirait le message. */
const noEmbed = (url: string): string => `<${url}>`;
