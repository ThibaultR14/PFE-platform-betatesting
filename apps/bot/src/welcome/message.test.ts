import { t } from "@microbeta/i18n";
import { ButtonStyle, ComponentType } from "discord.js";
import { describe, expect, it } from "vitest";
import { buildWelcomeMessage, WELCOME_NOTE_MAX, type WelcomeData } from "./message";

const base: WelcomeData = {
  testerId: "tester-1",
  campaignName: "Appli de covoiturage",
  ownerName: "Léa",
  welcomeMessage: "Merci de ton aide !\nÇa compte beaucoup.",
  productUrl: "https://covoit.example",
  duration: { count: 3, minutesPerTest: 5, totalMinutes: 15 },
  webUrl: "https://microbeta.app",
};

describe("buildWelcomeMessage", () => {
  it("présente la campagne, le porteur, la durée et les liens", () => {
    const { content } = buildWelcomeMessage(base);
    expect(content).toContain("**Léa**");
    expect(content).toContain("**Appli de covoiturage**");
    expect(content).toContain(t("bot.welcome.durationMany", { count: 3, minutes: 5 }));
    expect(content).toContain("<https://covoit.example>");
    expect(content).toContain("<https://microbeta.app/confidentialite>");
    expect(content).toContain(t("bot.welcome.callToAction"));
  });

  it("cite le mot du porteur ligne par ligne", () => {
    const { content } = buildWelcomeMessage(base);
    expect(content).toContain("> Merci de ton aide !\n> Ça compte beaucoup.");
  });

  it("coupe un mot du porteur trop long", () => {
    const { content } = buildWelcomeMessage({ ...base, welcomeMessage: "a".repeat(5_000) });
    expect(content).toContain(`> ${"a".repeat(WELCOME_NOTE_MAX)}…`);
    expect(content.length).toBeLessThan(2_000);
  });

  it("porte un bouton d'accord lié au testeur", () => {
    const { components } = buildWelcomeMessage(base);
    expect(components).toEqual([
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.Button,
            custom_id: "consent:tester-1",
            label: t("bot.welcome.button"),
            style: ButtonStyle.Success,
          },
        ],
      },
    ]);
  });

  it("omet le lien de confidentialité sans PUBLIC_WEB_URL", () => {
    const { content } = buildWelcomeMessage({ ...base, webUrl: null });
    expect(content).not.toContain("confidentialite");
  });

  it("n'ajoute pas de paragraphe vide sans lien ni mot du porteur", () => {
    const { content } = buildWelcomeMessage({
      ...base,
      welcomeMessage: "  ",
      productUrl: null,
      webUrl: null,
    });
    expect(content).not.toMatch(/\n{3,}/);
    expect(content).not.toContain(">");
    expect(content.split("\n\n")).toHaveLength(3);
  });

  it("adapte la durée à un seul micro-test, et l'omet sans micro-test", () => {
    const one = buildWelcomeMessage({
      ...base,
      duration: { count: 1, minutesPerTest: 4, totalMinutes: 4 },
    });
    expect(one.content).toContain(t("bot.welcome.durationOne", { minutes: 4 }));

    const none = buildWelcomeMessage({
      ...base,
      duration: { count: 0, minutesPerTest: 0, totalMinutes: 0 },
    });
    expect(none.content).not.toContain("micro-test");
  });
});
