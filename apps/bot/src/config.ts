export interface BotConfig {
  discordToken: string;
  applicationId: string;
  hubGuildId: string;
}

const REQUIRED = {
  discordToken: "DISCORD_BOT_TOKEN",
  applicationId: "DISCORD_APPLICATION_ID",
  hubGuildId: "DISCORD_HUB_GUILD_ID",
} as const;

/** Lit la config du bot depuis l'environnement. Lève une erreur qui liste les variables manquantes. */
export function loadConfig(env: Record<string, string | undefined> = process.env): BotConfig {
  const missing = Object.values(REQUIRED).filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes : ${missing.join(", ")}`);
  }

  return {
    discordToken: env[REQUIRED.discordToken] ?? "",
    applicationId: env[REQUIRED.applicationId] ?? "",
    hubGuildId: env[REQUIRED.hubGuildId] ?? "",
  };
}
