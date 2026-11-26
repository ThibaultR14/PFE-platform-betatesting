import { t, type MessageKey } from "@microbeta/i18n";
import { MessageFlags } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import type { ConsentResult } from "../../welcome/consent";
import { fakeButtonInteraction } from "../fake-interaction";
import { consentButton } from "./consent";

describe("consentButton", () => {
  it("transmet le testeur et la personne qui clique", async () => {
    const accept = vi.fn(async (): Promise<ConsentResult> => "accepted");
    const { interaction } = fakeButtonInteraction("consent:tester-1", { userId: "42" });
    await consentButton(accept).execute(interaction, "tester-1");
    expect(accept).toHaveBeenCalledExactlyOnceWith("tester-1", "42");
  });

  it("accord enregistré : retire le bouton et ajoute la confirmation au message", async () => {
    const { interaction, update, reply } = fakeButtonInteraction("consent:tester-1", {
      messageContent: "Bienvenue",
    });
    await consentButton(async () => "accepted").execute(interaction, "tester-1");
    expect(update).toHaveBeenCalledExactlyOnceWith({
      content: `Bienvenue\n\n${t("bot.consent.accepted")}`,
      components: [],
    });
    expect(reply).not.toHaveBeenCalled();
  });

  it.each<[ConsentResult, MessageKey]>([
    ["alreadyAccepted", "bot.consent.alreadyAccepted"],
    ["optedOut", "bot.consent.optedOut"],
    ["notYou", "bot.consent.notYou"],
    ["unknownTester", "bot.consent.unknownTester"],
  ])("%s : réponse éphémère, message inchangé", async (result, key) => {
    const { interaction, update, reply } = fakeButtonInteraction("consent:tester-1");
    await consentButton(async () => result).execute(interaction, "tester-1");
    expect(reply).toHaveBeenCalledExactlyOnceWith({
      content: t(key),
      flags: MessageFlags.Ephemeral,
    });
    expect(update).not.toHaveBeenCalled();
  });
});
