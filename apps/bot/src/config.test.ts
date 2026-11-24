import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";

describe("loadConfig", () => {
  it("lit les variables requises", () => {
    const config = loadConfig({
      DISCORD_BOT_TOKEN: "token",
      DISCORD_APPLICATION_ID: "app",
      DISCORD_HUB_GUILD_ID: "guild",
    });
    expect(config).toEqual({ discordToken: "token", applicationId: "app", hubGuildId: "guild" });
  });

  it("liste toutes les variables manquantes", () => {
    expect(() => loadConfig({ DISCORD_BOT_TOKEN: "token" })).toThrow(
      "Variables d'environnement manquantes : DISCORD_APPLICATION_ID, DISCORD_HUB_GUILD_ID",
    );
  });
});
