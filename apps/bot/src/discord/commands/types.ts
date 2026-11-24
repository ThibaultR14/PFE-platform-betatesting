import {
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";

/** Réponse visible par le seul utilisateur qui a lancé la commande. */
export interface EphemeralReply {
  content: string;
  flags: MessageFlags.Ephemeral;
}

export function ephemeral(content: string): EphemeralReply {
  return { content, flags: MessageFlags.Ephemeral };
}

/**
 * Ce que les commandes utilisent d'une `ChatInputCommandInteraction` discord.js.
 * Un sous-ensemble, pour pouvoir passer une fausse interaction dans les tests.
 */
export interface CommandInteraction {
  readonly commandName: string;
  readonly replied: boolean;
  readonly deferred: boolean;
  reply(options: EphemeralReply): Promise<unknown>;
  followUp(options: EphemeralReply): Promise<unknown>;
}

export interface BotCommand {
  /** Déclaration envoyée à Discord. */
  data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute(interaction: CommandInteraction): Promise<void>;
}

/**
 * Base commune des slash commands : utilisables sur un serveur et en message privé avec le bot.
 * Le nom et la description viennent de l'i18n.
 */
export function slashCommand(name: string, description: string): SlashCommandBuilder {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall);
}
