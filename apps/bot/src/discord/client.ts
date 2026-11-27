import { t } from "@microbeta/i18n";
import { Client, Events, GatewayIntentBits, REST } from "discord.js";
import type { DiscordConfig } from "../config";
import { componentMap, type BotComponents } from "./buttons";
import { commandMap, type BotCommand } from "./commands";
import { handleCommand, handleComponent } from "./interactions";
import { registerCommands } from "./register";

/**
 * `Guilds` seul : les slash commands, les boutons, les menus et les fenêtres de saisie arrivent par
 * les interactions, qui ne demandent aucun intent. Jamais d'intent privilégié (MessageContent,
 * GuildMembers, GuildPresences). Le bot ne reçoit donc pas les messages écrits en privé.
 */
export const INTENTS = [GatewayIntentBits.Guilds] as const;

/**
 * Enregistre les commandes, puis connecte le bot à Discord.
 * Lève une erreur si Discord refuse le token ou l'Application ID.
 */
export async function startDiscord(
  config: DiscordConfig,
  commands: readonly BotCommand[],
  createComponents: (client: Client) => BotComponents,
): Promise<Client> {
  const byName = commandMap(commands);

  const rest = new REST().setToken(config.token);
  await registerCommands(rest, config.applicationId, commands);

  const client = new Client({ intents: [...INTENTS] });
  // Les composants ont besoin du client (pour écrire en privé) : créés une fois le client prêt.
  const components = createComponents(client);
  const buttons = componentMap(components.buttons);
  const selects = componentMap(components.selects);
  const modals = componentMap(components.modals);
  client.once(Events.ClientReady, (ready) => {
    console.log(`[bot] ${t("bot.ready", { tag: ready.user.tag })}`);
  });
  client.on(Events.InteractionCreate, (interaction) => {
    if (interaction.isChatInputCommand()) void handleCommand(interaction, byName);
    else if (interaction.isButton()) void handleComponent(interaction, buttons);
    else if (interaction.isStringSelectMenu()) void handleComponent(interaction, selects);
    // Seules les fenêtres ouvertes depuis un message : leur envoi modifie ce message.
    else if (interaction.isModalSubmit() && interaction.isFromMessage()) {
      void handleComponent(interaction, modals);
    }
  });
  client.on(Events.Error, (error) => console.error("[discord]", error));

  try {
    await client.login(config.token);
  } catch (error) {
    await client.destroy();
    throw error;
  }
  return client;
}
