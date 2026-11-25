import { vi } from "vitest";
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
