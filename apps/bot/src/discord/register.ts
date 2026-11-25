import { Routes } from "discord.js";
import type { BotCommand } from "./commands";

/** Ce que l'enregistrement utilise du client REST discord.js (faux client dans les tests). */
export interface CommandsRest {
  put(route: `/${string}`, options: { body: unknown }): Promise<unknown>;
}

/**
 * Enregistre les slash commands globales du bot. Le `PUT` remplace toute la liste :
 * on peut le relancer à chaque démarrage sans doublon, et une commande retirée du code disparaît.
 */
export async function registerCommands(
  rest: CommandsRest,
  applicationId: string,
  commands: readonly BotCommand[],
): Promise<void> {
  await rest.put(Routes.applicationCommands(applicationId), {
    body: commands.map((command) => command.data),
  });
}
