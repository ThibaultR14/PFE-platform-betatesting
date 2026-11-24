export interface DiscordConfig {
  token: string;
  applicationId: string;
  hubGuildId: string;
}

export interface BotConfig {
  databaseUrl: string;
  /** `null` tant que les variables Discord ne sont pas toutes renseignées (branché dans #22). */
  discord: DiscordConfig | null;
}

const DISCORD_VARS = {
  token: "DISCORD_BOT_TOKEN",
  applicationId: "DISCORD_APPLICATION_ID",
  hubGuildId: "DISCORD_HUB_GUILD_ID",
} as const;

/**
 * Lit la config du bot depuis l'environnement.
 * `DATABASE_URL` est obligatoire. Les variables Discord sont toutes présentes ou toutes absentes :
 * en renseigner seulement une partie est une erreur, qui liste celles qui manquent.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): BotConfig {
  const databaseUrl = env.DATABASE_URL ?? "";
  if (!databaseUrl) {
    throw new Error("Variables d'environnement manquantes : DATABASE_URL");
  }

  const missing = Object.values(DISCORD_VARS).filter((name) => !env[name]);
  if (missing.length === Object.keys(DISCORD_VARS).length) {
    return { databaseUrl, discord: null };
  }
  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes : ${missing.join(", ")}`);
  }

  return {
    databaseUrl,
    discord: {
      token: env[DISCORD_VARS.token] ?? "",
      applicationId: env[DISCORD_VARS.applicationId] ?? "",
      hubGuildId: env[DISCORD_VARS.hubGuildId] ?? "",
    },
  };
}
