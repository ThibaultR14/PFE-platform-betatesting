import { assertTesterLinkSecret } from "@microbeta/core";

export interface DiscordConfig {
  token: string;
  applicationId: string;
  hubGuildId: string;
}

export interface BotConfig {
  databaseUrl: string;
  /** `null` tant que les variables Discord ne sont pas toutes renseignées (branché dans #22). */
  discord: DiscordConfig | null;
  /**
   * URL publique du site, sans `/` final (`PUBLIC_WEB_URL`), pour les liens envoyés aux testeurs
   * (page de confidentialité…). `null` si elle n'est pas renseignée : les liens sont alors omis.
   */
  webUrl: string | null;
  /**
   * Secret partagé avec le site pour signer les liens vers la page web testeur
   * (`TESTER_LINK_SECRET`). `null` s'il n'est pas renseigné : le lien « Répondre sur le web » est omis.
   */
  testerLinkSecret: string | null;
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

  const webUrl = parseWebUrl(env.PUBLIC_WEB_URL);
  const testerLinkSecret = parseTesterLinkSecret(env.TESTER_LINK_SECRET);

  const missing = Object.values(DISCORD_VARS).filter((name) => !env[name]);
  if (missing.length === Object.keys(DISCORD_VARS).length) {
    return { databaseUrl, discord: null, webUrl, testerLinkSecret };
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
    webUrl,
    testerLinkSecret,
  };
}

/** Valide `PUBLIC_WEB_URL` (http ou https) et retire le `/` final. Une valeur vide vaut `null`. */
function parseWebUrl(value: string | undefined): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`PUBLIC_WEB_URL invalide : "${value}" (ex. http://localhost:3000)`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`PUBLIC_WEB_URL doit commencer par http:// ou https:// : "${value}"`);
  }
  return value.replace(/\/+$/, "");
}

/** Une valeur vide vaut `null`. Un secret trop court est une erreur, pas un lien désactivé en silence. */
function parseTesterLinkSecret(value: string | undefined): string | null {
  if (!value) return null;
  assertTesterLinkSecret(value);
  return value;
}
