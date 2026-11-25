import { t } from "@microbeta/i18n";
import { Client, Events, GatewayIntentBits, REST } from "discord.js";
import type { DiscordConfig } from "../config";
import { commandMap, type BotCommand } from "./commands";
import { handleCommand } from "./interactions";
import { registerCommands } from "./register";

/**
 * `Guilds` seul : les slash commands et les boutons arrivent par les interactions, qui ne
 * demandent aucun intent. Jamais d'intent privilégié (MessageContent, GuildMembers, GuildPresences).
 */
export const INTENTS = [GatewayIntentBits.Guilds] as const;

/**
 * Enregistre les commandes, puis connecte le bot à Discord.
 * Lève une erreur si Discord refuse le token ou l'Application ID.
 */
export async function startDiscord(
  config: DiscordConfig,
  commands: readonly BotCommand[],
): Promise<Client> {
  const byName = commandMap(commands);

  const rest = new REST().setToken(config.token);
  await registerCommands(rest, config.applicationId, commands);

  const client = new Client({ intents: [...INTENTS] });
  client.once(Events.ClientReady, (ready) => {
    console.log(`[bot] ${t("bot.ready", { tag: ready.user.tag })}`);
  });
  client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    void handleCommand(interaction, byName);
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
