import { describe, expect, it } from "vitest";
import { t } from "./index";

describe("t", () => {
  it("renvoie un texte simple", () => {
    expect(t("app.name")).toBe("MicroBeta");
  });

  it("remplace les paramètres", () => {
    expect(t("bot.ready", { tag: "MicroBeta#0001" })).toBe(
      "Bot connecté en tant que MicroBeta#0001",
    );
  });

  it("laisse visible un paramètre manquant", () => {
    expect(t("bot.ready")).toBe("Bot connecté en tant que {tag}");
  });
});
