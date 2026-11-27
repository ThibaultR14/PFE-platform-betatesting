import { t } from "@microbeta/i18n";
import { ButtonStyle, ComponentType } from "discord.js";
import { describe, expect, it } from "vitest";
import {
  buildMicroTestMessage,
  DISCORD_MESSAGE_MAX,
  INSTRUCTIONS_MAX,
  OPTIONS_MAX,
  parseOptions,
  questionContent,
  type MicroTestMessageData,
  type QuestionView,
} from "./message";

const rating: QuestionView = {
  type: "RATING",
  prompt: "Est-il facile de publier un trajet ?",
  options: null,
  required: true,
};

const base: MicroTestMessageData = {
  title: "Publier un trajet",
  instructions: "Ouvre l'appli.\nPublie un trajet vers le campus.",
  estimatedMinutes: 5,
  questionCount: 4,
  question: rating,
  webLink: "https://microbeta.app/t/jeton",
};

describe("buildMicroTestMessage", () => {
  it("présente le micro-test, sa durée et la première question", () => {
    const { content } = buildMicroTestMessage(base);
    expect(content).toContain(t("bot.microtest.title", { title: "Publier un trajet" }));
    expect(content).toContain(t("bot.microtest.durationMany", { minutes: 5, count: 4 }));
    expect(content).toContain(t("bot.microtest.questionHeader", { number: 1, count: 4 }));
    expect(content).toContain("Est-il facile de publier un trajet ?");
    expect(content).toContain(t("bot.microtest.hint.RATING"));
  });

  it("dit « 1 question » quand il n'y en a qu'une", () => {
    const { content } = buildMicroTestMessage({ ...base, questionCount: 1 });
    expect(content).toContain(t("bot.microtest.durationOne", { minutes: 5 }));
  });

  it("cite les consignes ligne par ligne, et les omet si elles sont vides", () => {
    expect(buildMicroTestMessage(base).content).toContain(
      "> Ouvre l'appli.\n> Publie un trajet vers le campus.",
    );
    const { content } = buildMicroTestMessage({ ...base, instructions: "  " });
    expect(content).not.toContain(">");
    expect(content).not.toContain("\n\n\n");
  });

  it("coupe des consignes trop longues", () => {
    const { content } = buildMicroTestMessage({ ...base, instructions: "a".repeat(5_000) });
    expect(content).toContain(`> ${"a".repeat(INSTRUCTIONS_MAX - 1)}…`);
  });

  it("tient dans un message Discord, même avec des textes énormes", () => {
    const huge = "x\n".repeat(3_000);
    const { content } = buildMicroTestMessage({
      ...base,
      title: huge,
      instructions: huge,
      question: {
        type: "MULTI",
        prompt: huge,
        options: Array.from({ length: 50 }, () => "o".repeat(500)),
        required: false,
      },
    });
    expect(content.length).toBeLessThanOrEqual(DISCORD_MESSAGE_MAX);
  });

  it("porte le bouton « Répondre sur le web » vers le lien signé", () => {
    const { content, components } = buildMicroTestMessage(base);
    expect(content).toContain(t("bot.microtest.webHint"));
    expect(components).toEqual([
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.Button,
            style: ButtonStyle.Link,
            url: "https://microbeta.app/t/jeton",
            label: t("bot.microtest.webButton"),
          },
        ],
      },
    ]);
  });

  it("sans lien configuré : ni bouton, ni phrase qui l'annonce", () => {
    const { content, components } = buildMicroTestMessage({ ...base, webLink: null });
    expect(components).toEqual([]);
    expect(content).not.toContain(t("bot.microtest.webHint"));
  });
});

describe("questionContent", () => {
  it.each(["TEXT", "RATING", "YESNO", "SINGLE", "MULTI"] as const)(
    "indique comment répondre à une question %s",
    (type) => {
      const content = questionContent({ ...rating, type, options: ["A", "B"] }, 2, 3);
      expect(content).toContain(t("bot.microtest.questionHeader", { number: 2, count: 3 }));
      expect(content).toContain(`_${t(`bot.microtest.hint.${type}`)}_`);
    },
  );

  it("liste les choix des questions SINGLE et MULTI, pas des autres", () => {
    const options = ["Oui, souvent", "Parfois", "Jamais"];
    const single = questionContent({ ...rating, type: "SINGLE", options }, 1, 1);
    expect(single).toContain("1. Oui, souvent\n2. Parfois\n3. Jamais");
    const text = questionContent({ ...rating, type: "TEXT", options }, 1, 1);
    expect(text).not.toContain("1. Oui, souvent");
  });

  it("signale une question facultative", () => {
    const content = questionContent({ ...rating, required: false }, 1, 1);
    expect(content).toContain(`${rating.prompt} ${t("bot.microtest.optional")}`);
  });
});

describe("parseOptions", () => {
  it("garde les textes non vides, coupés, et 25 au plus", () => {
    expect(parseOptions(["A", "", "  B  ", 3, null])).toEqual(["A", "B"]);
    expect(parseOptions(Array.from({ length: 40 }, (_, i) => `choix ${i}`))).toHaveLength(
      OPTIONS_MAX,
    );
    expect(parseOptions(["c".repeat(200)])[0]).toHaveLength(80);
  });

  it("une valeur mal formée donne une liste vide", () => {
    expect(parseOptions(null)).toEqual([]);
    expect(parseOptions({ a: 1 })).toEqual([]);
    expect(parseOptions("A,B")).toEqual([]);
  });
});
