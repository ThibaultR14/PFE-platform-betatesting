import type { APIActionRowComponent, APIComponentInMessageActionRow } from "discord.js";

/** Un message privé du bot : texte et, éventuellement, une ou plusieurs rangées de boutons. */
export interface DmMessage {
  content: string;
  components: APIActionRowComponent<APIComponentInMessageActionRow>[];
}

/**
 * Envoie un message privé à un utilisateur Discord. Le vrai client discord.js l'implémente
 * (`discord/dm.ts`), et les tests passent un faux.
 */
export interface DmSender {
  send(discordUserId: string, message: DmMessage): Promise<void>;
}

/**
 * Le bot ne peut pas écrire à cet utilisateur : messages privés fermés, aucun serveur en commun,
 * ou compte supprimé. Réessayer ne changerait rien.
 */
export class DmUnavailableError extends Error {
  constructor(
    readonly discordUserId: string,
    readonly reason: string,
  ) {
    super(`Impossible d'écrire en privé à ${discordUserId} : ${reason}`);
    this.name = "DmUnavailableError";
  }
}
