import { t } from "@microbeta/i18n";
import { MessageFlags } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import { componentMap, type BotButton, type BotModal, type BotSelect } from "./buttons";
import { commandMap, type BotCommand } from "./commands";
import { slashCommand } from "./commands/types";
import {
  fakeButtonInteraction,
  fakeInteraction,
  fakeModalInteraction,
  fakeSelectInteraction,
} from "./fake-interaction";
import { handleCommand, handleComponent } from "./interactions";

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

describe("handleComponent", () => {
  const button = (prefix: string, execute: BotButton["execute"]): BotButton => ({
    prefix,
    execute,
  });

  it("exécute le bouton choisi par le préfixe, avec l'argument du customId", async () => {
    const consent = vi.fn(async () => {});
    const other = vi.fn(async () => {});
    const { interaction } = fakeButtonInteraction("consent:tester-1");
    await handleComponent(
      interaction,
      componentMap([button("consent", consent), button("autre", other)]),
    );
    expect(consent).toHaveBeenCalledExactlyOnceWith(interaction, "tester-1");
    expect(other).not.toHaveBeenCalled();
  });

  it("répond à un bouton inconnu", async () => {
    const { interaction, reply } = fakeButtonInteraction("disparu:1");
    await handleComponent(interaction, componentMap([]));
    expect(reply).toHaveBeenCalledExactlyOnceWith(ephemeral(t("bot.errors.unknownButton")));
  });

  it("logue un bouton qui échoue et répond un message générique", async () => {
    const failure = new Error("boum");
    const logError = vi.fn();
    const { interaction, reply } = fakeButtonInteraction("casse:1");
    await handleComponent(
      interaction,
      componentMap([
        button("casse", async () => {
          throw failure;
        }),
      ]),
      logError,
    );
    expect(logError).toHaveBeenCalledWith(expect.stringContaining("casse:1"), failure);
    expect(reply).toHaveBeenCalledExactlyOnceWith(ephemeral(t("bot.errors.generic")));
  });

  it("refuse deux boutons du même préfixe", () => {
    const noop = async () => {};
    expect(() => componentMap([button("x", noop), button("x", noop)])).toThrow("x");
  });

  it("route aussi les menus de sélection et les fenêtres de saisie par préfixe", async () => {
    const pick = vi.fn<BotSelect["execute"]>(async () => {});
    const select = fakeSelectInteraction("pick:a:q:1", ["0", "2"]);
    await handleComponent(select.interaction, componentMap([{ prefix: "pick", execute: pick }]));
    expect(pick).toHaveBeenCalledExactlyOnceWith(select.interaction, "a:q:1");

    const submit = vi.fn<BotModal["execute"]>(async () => {});
    const modal = fakeModalInteraction("textm:a:q:1", { answer: "Super" });
    await handleComponent(modal.interaction, componentMap([{ prefix: "textm", execute: submit }]));
    expect(submit).toHaveBeenCalledExactlyOnceWith(modal.interaction, "a:q:1");
  });

  it("répond à un menu inconnu", async () => {
    const { interaction, reply } = fakeSelectInteraction("disparu:1", []);
    await handleComponent(interaction, componentMap<BotSelect>([]));
    expect(reply).toHaveBeenCalledExactlyOnceWith(ephemeral(t("bot.errors.unknownButton")));
  });
});
