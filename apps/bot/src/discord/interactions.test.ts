import { t } from "@microbeta/i18n";
import { MessageFlags } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import { commandMap, type BotCommand } from "./commands";
import { slashCommand } from "./commands/types";
import { fakeInteraction } from "./fake-interaction";
import { handleCommand } from "./interactions";

function command(name: string, execute: BotCommand["execute"]): BotCommand {
  return { data: slashCommand(name, "description").toJSON(), execute };
}

const ephemeral = (content: string) => ({ content, flags: MessageFlags.Ephemeral });

describe("handleCommand", () => {
  it("exécute la commande demandée", async () => {
    const ping = vi.fn(async () => {});
    const other = vi.fn(async () => {});
    const { interaction } = fakeInteraction("ping");
    await handleCommand(interaction, commandMap([command("ping", ping), command("autre", other)]));
    expect(ping).toHaveBeenCalledExactlyOnceWith(interaction);
    expect(other).not.toHaveBeenCalled();
  });

  it("répond à une commande inconnue", async () => {
    const { interaction, reply } = fakeInteraction("disparue");
    await handleCommand(interaction, commandMap([]));
    expect(reply).toHaveBeenCalledExactlyOnceWith(ephemeral(t("bot.errors.unknownCommand")));
  });

  it("logue une commande qui échoue et répond un message générique", async () => {
    const failure = new Error("boum");
    const logError = vi.fn();
    const { interaction, reply } = fakeInteraction("casse");
    await handleCommand(
      interaction,
      commandMap([
        command("casse", async () => {
          throw failure;
        }),
      ]),
      logError,
    );
    expect(logError).toHaveBeenCalledWith(expect.stringContaining("/casse"), failure);
    expect(reply).toHaveBeenCalledExactlyOnceWith(ephemeral(t("bot.errors.generic")));
  });

  it("complète la réponse déjà envoyée au lieu d'en refaire une", async () => {
    const { interaction, reply, followUp } = fakeInteraction("casse", { replied: true });
    await handleCommand(
      interaction,
      commandMap([
        command("casse", async () => {
          throw new Error("boum");
        }),
      ]),
      vi.fn(),
    );
    expect(reply).not.toHaveBeenCalled();
    expect(followUp).toHaveBeenCalledExactlyOnceWith(ephemeral(t("bot.errors.generic")));
  });

  it("ne lève pas d'erreur si la réponse d'erreur échoue aussi", async () => {
    const logError = vi.fn();
    const { interaction, reply } = fakeInteraction("casse");
    reply.mockRejectedValue(new Error("interaction expirée"));
    await expect(
      handleCommand(
        interaction,
        commandMap([
          command("casse", async () => {
            throw new Error("boum");
          }),
        ]),
        logError,
      ),
    ).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledTimes(2);
  });
});
