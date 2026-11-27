import type { APIModalInteractionResponseCallbackData } from "discord.js";
import { vi } from "vitest";
import type {
  ButtonInteraction,
  MessageUpdate,
  ModalInteraction,
  SelectInteraction,
} from "./buttons";
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

interface ComponentOptions {
  userId?: string;
  messageContent?: string;
}

/** Ce qui est commun aux fausses interactions de composants. */
function fakeComponent(customId: string, options: ComponentOptions) {
  const reply = vi.fn(async (_options: EphemeralReply): Promise<unknown> => undefined);
  const followUp = vi.fn(async (_options: EphemeralReply): Promise<unknown> => undefined);
  const update = vi.fn(async (_options: MessageUpdate): Promise<unknown> => undefined);
  const base = {
    customId,
    user: { id: options.userId ?? "300000000000000001" },
    message: { content: options.messageContent ?? "Message d'origine" },
    replied: false,
    deferred: false,
    reply,
    followUp,
    update,
  };
  return { base, reply, followUp, update };
}

/** Fausse interaction de bouton pour les tests. */
export function fakeButtonInteraction(customId: string, options: ComponentOptions = {}) {
  const { base, ...mocks } = fakeComponent(customId, options);
  const showModal = vi.fn(
    async (_modal: APIModalInteractionResponseCallbackData): Promise<unknown> => undefined,
  );
  const interaction: ButtonInteraction = { ...base, showModal };
  return { interaction, showModal, ...mocks };
}

/** Fausse interaction de menu de sélection pour les tests. */
export function fakeSelectInteraction(
  customId: string,
  values: readonly string[],
  options: ComponentOptions = {},
) {
  const { base, ...mocks } = fakeComponent(customId, options);
  const interaction: SelectInteraction = { ...base, values };
  return { interaction, ...mocks };
}

/** Fausse fenêtre de saisie envoyée pour les tests : `fields` donne le texte de chaque champ. */
export function fakeModalInteraction(
  customId: string,
  fields: Record<string, string>,
  options: ComponentOptions = {},
) {
  const { base, ...mocks } = fakeComponent(customId, options);
  const interaction: ModalInteraction = {
    ...base,
    fields: { getTextInputValue: (id) => fields[id] ?? "" },
  };
  return { interaction, ...mocks };
}
