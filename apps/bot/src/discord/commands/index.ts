import { aide } from "./aide";
import type { BotCommand } from "./types";

export type { BotCommand, CommandInteraction, EphemeralReply } from "./types";

/** Toutes les slash commands du bot. Une commande retirée d'ici disparaît de Discord au démarrage suivant. */
export const commands: readonly BotCommand[] = [aide];

/** Indexe les commandes par nom. Deux commandes du même nom sont une erreur de code. */
export function commandMap(list: readonly BotCommand[]): ReadonlyMap<string, BotCommand> {
  const map = new Map<string, BotCommand>();
  for (const command of list) {
    if (map.has(command.data.name)) {
      throw new Error(`Commande déclarée deux fois : /${command.data.name}`);
    }
    map.set(command.data.name, command);
  }
  return map;
}
