import { DiscordAPIError, RESTJSONErrorCodes, type Client } from "discord.js";
import { DmUnavailableError, type DmSender } from "../messaging";

/** Codes Discord qui veulent dire « impossible d'écrire à cet utilisateur », définitivement. */
const UNAVAILABLE_CODES: ReadonlySet<number | string> = new Set([
  RESTJSONErrorCodes.CannotSendMessagesToThisUser,
  RESTJSONErrorCodes.CannotSendMessagesToThisUserDueToHavingNoMutualGuilds,
  RESTJSONErrorCodes.UnknownUser,
]);

/** Traduit une erreur discord.js : `DmUnavailableError` si l'envoi est impossible, sinon l'erreur d'origine. */
export function toDmError(discordUserId: string, error: unknown): unknown {
  if (error instanceof DiscordAPIError && UNAVAILABLE_CODES.has(error.code)) {
    return new DmUnavailableError(discordUserId, `${error.code} ${error.message}`);
  }
  return error;
}

export function discordDmSender(client: Client): DmSender {
  return {
    async send(discordUserId, message) {
      try {
        await client.users.send(discordUserId, message);
      } catch (error) {
        throw toDmError(discordUserId, error);
      }
    },
  };
}
