import { t } from "@microbeta/i18n";
import type { ComponentHandler, ComponentInteraction } from "./buttons";
import { parseCustomId } from "./buttons/custom-id";
import type { BotCommand, CommandInteraction, EphemeralReply } from "./commands";
import { ephemeral } from "./commands/types";

type LogError = (message: string, error: unknown) => void;

const defaultLogError: LogError = (message, error) => console.error(message, error);

/** Ce qu'il faut d'une interaction pour lui répondre en éphémère. */
interface Respondable {
  readonly replied: boolean;
  readonly deferred: boolean;
  reply(options: EphemeralReply): Promise<unknown>;
  followUp(options: EphemeralReply): Promise<unknown>;
}

/** Répond en éphémère, en complément si l'interaction a déjà reçu une réponse. */
async function respond(interaction: Respondable, content: string): Promise<void> {
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(ephemeral(content));
  } else {
    await interaction.reply(ephemeral(content));
  }
}

/**
 * Lance `run`. S'il lève une erreur : on la logue et l'utilisateur reçoit un message générique.
 * Ne lève jamais d'erreur : un échec ne doit pas faire tomber le bot.
 */
async function safely(
  interaction: Respondable,
  label: string,
  logError: LogError,
  run: () => Promise<void>,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    logError(`[discord] ${label} a échoué :`, error);
    try {
      await respond(interaction, t("bot.errors.generic"));
    } catch (replyError) {
      // Interaction expirée ou déjà traitée : rien de plus à faire côté utilisateur.
      logError(`[discord] impossible de répondre à ${label} :`, replyError);
    }
  }
}

/**
 * Exécute la slash command demandée.
 * - Commande inconnue (par ex. une ancienne commande encore affichée par Discord) : message d'aide.
 * - Erreur dans la commande : loguée, et l'utilisateur reçoit un message générique.
 */
export async function handleCommand(
  interaction: CommandInteraction,
  commands: ReadonlyMap<string, BotCommand>,
  logError: LogError = defaultLogError,
): Promise<void> {
  const command = commands.get(interaction.commandName);
  await safely(interaction, `/${interaction.commandName}`, logError, async () => {
    if (!command) {
      await respond(interaction, t("bot.errors.unknownCommand"));
      return;
    }
    await command.execute(interaction);
  });
}

/**
 * Exécute le composant utilisé (bouton, menu de sélection ou fenêtre de saisie), choisi par le
 * préfixe de son `customId`.
 * - Composant inconnu (par ex. sur un ancien message) : réponse éphémère.
 * - Erreur dans le handler : loguée, et l'utilisateur reçoit un message générique.
 */
export async function handleComponent<I extends ComponentInteraction>(
  interaction: I,
  handlers: ReadonlyMap<string, ComponentHandler<I>>,
  logError: LogError = defaultLogError,
): Promise<void> {
  const { prefix, arg } = parseCustomId(interaction.customId);
  const handler = handlers.get(prefix);
  await safely(interaction, `le composant ${interaction.customId}`, logError, async () => {
    if (!handler) {
      await respond(interaction, t("bot.errors.unknownButton"));
      return;
    }
    await handler.execute(interaction, arg);
  });
}
