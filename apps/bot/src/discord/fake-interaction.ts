import { vi } from "vitest";
import type { ButtonInteraction, MessageUpdate } from "./buttons";
import type { CommandInteraction, EphemeralReply } from "./commands";

/** Fausse interaction pour les tests (fichier importé uniquement par les *.test.ts). */
export function fakeInteraction(
  commandName: string,
  state: { replied?: boolean; deferred?: boolean } = {},
) {
  const reply = vi.fn(async (_options: EphemeralReply): Promise<unknown> => undefined);
  const followUp = vi.fn(async (_options: EphemeralReply): Promise<unknown> => undefined);
  const interaction: CommandInteraction = {
    commandName,
    replied: state.replied ?? false,
    deferred: state.deferred ?? false,
    reply,
    followUp,
  };
  return { interaction, reply, followUp };
}

/** Fausse interaction de bouton pour les tests. */
export function fakeButtonInteraction(
  customId: string,
  options: { userId?: string; messageContent?: string } = {},
) {
  const reply = vi.fn(async (_options: EphemeralReply): Promise<unknown> => undefined);
  const followUp = vi.fn(async (_options: EphemeralReply): Promise<unknown> => undefined);
  const update = vi.fn(async (_options: MessageUpdate): Promise<unknown> => undefined);
  const interaction: ButtonInteraction = {
    customId,
    user: { id: options.userId ?? "300000000000000001" },
    message: { content: options.messageContent ?? "Message d'origine" },
    replied: false,
    deferred: false,
    reply,
    followUp,
    update,
  };
  return { interaction, reply, followUp, update };
}
