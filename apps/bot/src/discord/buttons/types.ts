import type { APIModalInteractionResponseCallbackData } from "discord.js";
import type { EphemeralReply } from "../commands";

/** Nouveau contenu d'un message modifié après un clic (les boutons sont retirés). */
export interface MessageUpdate {
  content: string;
  components: [];
}

/**
 * Ce que les handlers utilisent d'une interaction de composant discord.js (bouton, menu de
 * sélection, fenêtre de saisie ouverte depuis un message). Un sous-ensemble, pour pouvoir passer
 * une fausse interaction dans les tests.
 */
export interface ComponentInteraction {
  readonly customId: string;
  readonly user: { readonly id: string };
  /** Le message qui porte le composant. */
  readonly message: { readonly content: string };
  readonly replied: boolean;
  readonly deferred: boolean;
  reply(options: EphemeralReply): Promise<unknown>;
  /** Réponse éphémère en complément, quand l'interaction a déjà reçu une réponse. */
  followUp(options: EphemeralReply): Promise<unknown>;
  /** Modifie le message qui porte le composant (vaut réponse à l'interaction). */
  update(options: MessageUpdate): Promise<unknown>;
}

export interface ButtonInteraction extends ComponentInteraction {
  /** Ouvre une fenêtre de saisie : seulement en toute première réponse à l'interaction. */
  showModal(modal: APIModalInteractionResponseCallbackData): Promise<unknown>;
}

export interface SelectInteraction extends ComponentInteraction {
  /** Valeurs des choix sélectionnés. */
  readonly values: readonly string[];
}

export interface ModalInteraction extends ComponentInteraction {
  readonly fields: { getTextInputValue(customId: string): string };
}

/** Handler d'un type de composant, choisi par le préfixe de son `customId`. */
export interface ComponentHandler<I extends ComponentInteraction> {
  /** Préfixe du `customId` traité par ce handler (voir `custom-id.ts`). */
  prefix: string;
  /** `arg` : la partie du `customId` après le préfixe. */
  execute(interaction: I, arg: string): Promise<void>;
}

export type BotButton = ComponentHandler<ButtonInteraction>;
export type BotSelect = ComponentHandler<SelectInteraction>;
export type BotModal = ComponentHandler<ModalInteraction>;
