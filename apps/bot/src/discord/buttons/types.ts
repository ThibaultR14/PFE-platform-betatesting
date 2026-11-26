import type { EphemeralReply } from "../commands";

/** Nouveau contenu d'un message modifié après un clic (les boutons sont retirés). */
export interface MessageUpdate {
  content: string;
  components: [];
}

/**
 * Ce que les boutons utilisent d'une `ButtonInteraction` discord.js.
 * Un sous-ensemble, pour pouvoir passer une fausse interaction dans les tests.
 */
export interface ButtonInteraction {
  readonly customId: string;
  readonly user: { readonly id: string };
  /** Le message qui porte le bouton. */
  readonly message: { readonly content: string };
  readonly replied: boolean;
  readonly deferred: boolean;
  reply(options: EphemeralReply): Promise<unknown>;
  followUp(options: EphemeralReply): Promise<unknown>;
  /** Modifie le message qui porte le bouton (vaut réponse à l'interaction). */
  update(options: MessageUpdate): Promise<unknown>;
}

export interface BotButton {
  /** Préfixe du `customId` traité par ce bouton (voir `custom-id.ts`). */
  prefix: string;
  /** `arg` : la partie du `customId` après le préfixe. */
  execute(interaction: ButtonInteraction, arg: string): Promise<void>;
}
