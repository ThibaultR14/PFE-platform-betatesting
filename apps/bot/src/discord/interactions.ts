import { t } from "@microbeta/i18n";
import type { BotCommand, CommandInteraction } from "./commands";
import { ephemeral } from "./commands/types";

type LogError = (message: string, error: unknown) => void;

/** Répond en éphémère, en complément si l'interaction a déjà reçu une réponse. */
async function respond(interaction: CommandInteraction, content: string): Promise<void> {
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(ephemeral(content));
  } else {
    await interaction.reply(ephemeral(content));
  }
}

/**
 * Exécute la slash command demandée.
 * - Commande inconnue (par ex. une ancienne commande encore affichée par Discord) : message d'aide.
 * - Erreur dans la commande : loguée, et l'utilisateur reçoit un message générique.
 * Ne lève jamais d'erreur : un échec ne doit pas faire tomber le bot.
 */
export async function handleCommand(
  interaction: CommandInteraction,
  commands: ReadonlyMap<string, BotCommand>,
  logError: LogError = (message, error) => console.error(message, error),
): Promise<void> {
  const command = commands.get(interaction.commandName);
  try {
    if (!command) {
      await respond(interaction, t("bot.errors.unknownCommand"));
      return;
    }
    await command.execute(interaction);
  } catch (error) {
    logError(`[discord] /${interaction.commandName} a échoué :`, error);
    try {
      await respond(interaction, t("bot.errors.generic"));
    } catch (replyError) {
      // Interaction expirée ou déjà traitée : rien de plus à faire côté utilisateur.
      logError(`[discord] impossible de répondre à /${interaction.commandName} :`, replyError);
    }
  }
}
