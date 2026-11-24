import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";

const DB = { DATABASE_URL: "postgresql://localhost/db" };

describe("loadConfig", () => {
  it("lit la base et les variables Discord", () => {
    const config = loadConfig({
      ...DB,
      DISCORD_BOT_TOKEN: "token",
      DISCORD_APPLICATION_ID: "app",
      DISCORD_HUB_GUILD_ID: "guild",
    });
    expect(config).toEqual({
      databaseUrl: DB.DATABASE_URL,
      discord: { token: "token", applicationId: "app", hubGuildId: "guild" },
    });
  });

  it("démarre sans Discord si aucune variable Discord n'est renseignée", () => {
    expect(loadConfig(DB)).toEqual({ databaseUrl: DB.DATABASE_URL, discord: null });
  });

  it("exige DATABASE_URL", () => {
    expect(() => loadConfig({})).toThrow("Variables d'environnement manquantes : DATABASE_URL");
  });

  it("liste les variables Discord manquantes quand une partie seulement est renseignée", () => {
    expect(() => loadConfig({ ...DB, DISCORD_BOT_TOKEN: "token" })).toThrow(
      "Variables d'environnement manquantes : DISCORD_APPLICATION_ID, DISCORD_HUB_GUILD_ID",
    );
  });
});
