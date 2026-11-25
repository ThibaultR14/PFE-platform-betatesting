import { fr, t } from "@microbeta/i18n";
import { ApplicationIntegrationType, InteractionContextType, MessageFlags } from "discord.js";
import { describe, expect, it } from "vitest";
import { fakeInteraction } from "../fake-interaction";
import { aide } from "./aide";
import { commandMap, commands } from "./index";

describe("commandes", () => {
  it("ont un nom et une description tirés de l'i18n", () => {
    const fromI18n = Object.values(fr.bot.commands);
    for (const command of commands) {
      expect(fromI18n).toContainEqual({
        name: command.data.name,
        description: command.data.description,
      });
    }
  });

  it("sont utilisables sur un serveur et en message privé avec le bot", () => {
    for (const command of commands) {
      expect(command.data.contexts).toEqual([
        InteractionContextType.Guild,
        InteractionContextType.BotDM,
      ]);
      expect(command.data.integration_types).toEqual([ApplicationIntegrationType.GuildInstall]);
    }
  });

  it("ont des noms uniques", () => {
    expect(commandMap(commands).size).toBe(commands.length);
  });

  it("refusent deux commandes du même nom", () => {
    expect(() => commandMap([aide, aide])).toThrow("Commande déclarée deux fois : /aide");
  });
});

describe("/aide", () => {
  it("répond en éphémère avec le texte d'aide", async () => {
    const { interaction, reply } = fakeInteraction("aide");
    await aide.execute(interaction);
    expect(reply).toHaveBeenCalledExactlyOnceWith({
      content: t("bot.help.body", { appName: "MicroBeta" }),
      flags: MessageFlags.Ephemeral,
    });
  });

  it("n'a plus de paramètre à remplacer dans son texte", async () => {
    const { interaction, reply } = fakeInteraction("aide");
    await aide.execute(interaction);
    expect(reply.mock.calls[0]?.[0].content).not.toMatch(/\{\w+\}/);
  });
});
