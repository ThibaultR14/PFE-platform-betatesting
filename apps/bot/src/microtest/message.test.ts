import { OPTIONS_MAX } from "@microbeta/core";
import { t } from "@microbeta/i18n";
import {
  ButtonStyle,
  ComponentType,
  type APIActionRowComponent,
  type APIComponentInMessageActionRow,
} from "discord.js";
import { describe, expect, it } from "vitest";
import {
  answeredContent,
  answerText,
  buildMicroTestMessage,
  buildQuestionMessage,
  completionContent,
  displayOptions,
  DISCORD_MESSAGE_MAX,
  formatDelay,
  INSTRUCTIONS_MAX,
  questionComponents,
  questionContent,
  staleContent,
  type MicroTestMessageData,
  type QuestionView,
} from "./message";

// Des cuid, pour vérifier la longueur des customId dans les conditions réelles.
const ASSIGNMENT_ID = "cmigxk1ab0000abcdefghijkl";
const QUESTION_ID = "cmigxk1ab0001abcdefghijkl";
const WEB_LINK = "https://microbeta.app/t/jeton";

const rating: QuestionView = {
  id: QUESTION_ID,
  type: "RATING",
  prompt: "Est-il facile de publier un trajet ?",
  options: null,
  required: true,
  version: 3,
};

const base: MicroTestMessageData = {
  assignmentId: ASSIGNMENT_ID,
  title: "Publier un trajet",
  instructions: "Ouvre l'appli.\nPublie un trajet vers le campus.",
  estimatedMinutes: 5,
  questionCount: 4,
  question: rating,
  webLink: WEB_LINK,
};

type Row = APIActionRowComponent<APIComponentInMessageActionRow>;

/** Les composants d'une rangée, sous une forme simple à comparer. */
const summary = (rows: Row[]) =>
  rows.map((row) =>
    row.components.map((c) => {
      if (c.type === ComponentType.Button && c.style === ButtonStyle.Link) {
        return { link: c.url, label: c.label };
      }
      if (c.type === ComponentType.Button && "custom_id" in c) {
        return { button: c.custom_id, label: c.label };
      }
      if (c.type === ComponentType.StringSelect) {
        return {
          select: c.custom_id,
          min: c.min_values,
          max: c.max_values,
          count: c.options.length,
        };
      }
      return { other: c.type };
    }),
  );

const ref = `${ASSIGNMENT_ID}:${QUESTION_ID}:3`;
const web = { link: WEB_LINK, label: t("bot.microtest.webButton") };

describe("buildMicroTestMessage", () => {
  it("présente le micro-test, sa durée et la première question", () => {
    const { content } = buildMicroTestMessage(base);
    expect(content).toContain(t("bot.microtest.title", { title: "Publier un trajet" }));
    expect(content).toContain(t("bot.microtest.durationMany", { minutes: 5, count: 4 }));
    expect(content).toContain(t("bot.microtest.questionHeader", { number: 1, count: 4 }));
    expect(content).toContain("Est-il facile de publier un trajet ?");
    expect(content).toContain(t("bot.microtest.hint.RATING"));
  });

  it("dit de répondre avec les boutons (le bot ne lit pas les messages écrits)", () => {
    expect(buildMicroTestMessage(base).content).toContain(t("bot.microtest.buttonsOnly"));
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
        ...rating,
        type: "MULTI",
        prompt: huge,
        options: Array.from({ length: 50 }, () => "o".repeat(500)),
        required: false,
      },
    });
    expect(content.length).toBeLessThanOrEqual(DISCORD_MESSAGE_MAX);
  });

  it("porte les boutons de réponse de la première question, puis le bouton web", () => {
    const { content, components } = buildMicroTestMessage(base);
    expect(content).toContain(t("bot.microtest.webHint"));
    expect(summary(components)).toEqual([
      [1, 2, 3, 4, 5].map((n) => ({ button: `ans:${ref}:r${n}`, label: String(n) })),
      [web],
    ]);
  });

  it("sans lien configuré : ni bouton web, ni phrase qui l'annonce", () => {
    const { content, components } = buildMicroTestMessage({ ...base, webLink: null });
    expect(summary(components)).toHaveLength(1);
    expect(JSON.stringify(components)).not.toContain("microbeta.app");
    expect(content).not.toContain(t("bot.microtest.webHint"));
  });
});

describe("questionComponents", () => {
  const components = (patch: Partial<QuestionView>, webLink: string | null = null) =>
    summary(questionComponents(ASSIGNMENT_ID, { ...rating, ...patch }, webLink));

  it("YESNO : boutons Oui et Non", () => {
    expect(components({ type: "YESNO" })).toEqual([
      [
        { button: `ans:${ref}:yes`, label: t("bot.answer.yes") },
        { button: `ans:${ref}:no`, label: t("bot.answer.no") },
      ],
    ]);
  });

  it("TEXT : un bouton qui ouvre la fenêtre de saisie", () => {
    expect(components({ type: "TEXT" })).toEqual([
      [{ button: `text:${ref}`, label: t("bot.answer.write") }],
    ]);
  });

  it("SINGLE : un bouton par choix jusqu'à 5, numérotés comme dans core", () => {
    expect(components({ type: "SINGLE", options: ["iPhone", "", "Android"] })).toEqual([
      [
        { button: `ans:${ref}:c0`, label: "iPhone" },
        { button: `ans:${ref}:c1`, label: "Android" },
      ],
    ]);
  });

  it("SINGLE au-delà de 5 choix : un menu à un seul choix", () => {
    const options = ["A", "B", "C", "D", "E", "F"];
    expect(components({ type: "SINGLE", options })).toEqual([
      [{ select: `pick:${ref}`, min: 1, max: 1, count: 6 }],
    ]);
  });

  it("MULTI : un menu à plusieurs choix, 25 au plus", () => {
    expect(components({ type: "MULTI", options: ["Prix", "Bagages", "Rien"] })).toEqual([
      [{ select: `pick:${ref}`, min: 1, max: 3, count: 3 }],
    ]);
    const many = Array.from({ length: 40 }, (_, i) => `choix ${i}`);
    expect(components({ type: "MULTI", options: many })).toEqual([
      [{ select: `pick:${ref}`, min: 1, max: OPTIONS_MAX, count: OPTIONS_MAX }],
    ]);
  });

  it("question facultative : bouton « Passer », à côté du bouton web", () => {
    expect(components({ type: "YESNO", required: false }, WEB_LINK)[1]).toEqual([
      { button: `skip:${ref}`, label: t("bot.answer.skip") },
      web,
    ]);
    expect(JSON.stringify(components({ type: "YESNO" }, WEB_LINK))).not.toContain("skip:");
  });

  it("choix mal formés : pas de rangée de réponse vide", () => {
    expect(components({ type: "MULTI", options: null })).toEqual([]);
  });

  it("chaque customId tient dans la limite Discord de 100 caractères", () => {
    const all = (["RATING", "YESNO", "TEXT", "SINGLE", "MULTI"] as const).flatMap((type) =>
      components({ type, options: ["A", "B"], required: false, version: 12_345 }),
    );
    const ids = JSON.stringify(all).match(/"(button|select)":"[^"]+"/g) ?? [];
    expect(ids.length).toBeGreaterThan(5);
    for (const id of ids) expect(id.length).toBeLessThan(100);
  });
});

describe("buildQuestionMessage", () => {
  it("pose la question n/N avec ses boutons et le bouton web", () => {
    const message = buildQuestionMessage({
      assignmentId: ASSIGNMENT_ID,
      question: { ...rating, type: "YESNO" },
      number: 2,
      count: 4,
      webLink: WEB_LINK,
    });
    expect(message.content).toContain(t("bot.microtest.questionHeader", { number: 2, count: 4 }));
    expect(message.content).toContain(t("bot.microtest.hint.YESNO"));
    expect(message.content).not.toContain(t("bot.microtest.webHint"));
    expect(summary(message.components)).toEqual([
      [
        { button: `ans:${ref}:yes`, label: t("bot.answer.yes") },
        { button: `ans:${ref}:no`, label: t("bot.answer.no") },
      ],
      [web],
    ]);
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

describe("displayOptions", () => {
  it("garde la numérotation de core et coupe les choix à 80 caractères", () => {
    expect(displayOptions(["A", "", "  B  ", 3, null])).toEqual(["A", "B"]);
    expect(displayOptions(["c".repeat(200)])[0]).toHaveLength(80);
  });
});

describe("réponse affichée", () => {
  it("rappelle la réponse selon son type", () => {
    const shown = (value: string) => t("bot.answer.recorded", { value });
    expect(answerText(4)).toBe(shown(t("bot.answer.rating", { rating: 4 })));
    expect(answerText(true)).toBe(shown(t("bot.answer.yes")));
    expect(answerText(false)).toBe(shown(t("bot.answer.no")));
    expect(answerText("Android")).toBe(shown("Android"));
    expect(answerText(["Prix", "Rien"])).toBe(shown("Prix, Rien"));
    expect(answerText(null)).toBe(t("bot.answer.skipped"));
  });

  it("met un texte libre sur une ligne, coupé s'il est long", () => {
    expect(answerText("Le bouton\n\nétait caché")).toContain("Le bouton était caché");
    expect(answerText("a".repeat(1_000)).length).toBeLessThan(400);
  });

  it("ajoute la réponse sous la question, sans dépasser 2 000 caractères", () => {
    expect(answeredContent("Question 1/3", 4)).toBe(`Question 1/3\n\n${answerText(4)}`);
    const long = answeredContent("q".repeat(DISCORD_MESSAGE_MAX), "a".repeat(1_000));
    expect(long.length).toBeLessThanOrEqual(DISCORD_MESSAGE_MAX);
    expect(long).toContain(t("bot.answer.recorded", { value: "" }).trim());
  });

  it("signale une question modifiée depuis l'envoi", () => {
    expect(staleContent("Question 1/3")).toBe(`Question 1/3\n\n${t("bot.answer.stale")}`);
  });
});

describe("fin du micro-test", () => {
  const now = new Date("2026-11-27T12:00:00Z");
  const inHours = (hours: number) => new Date(now.getTime() + hours * 3_600_000);

  it("annonce le suivant, ou dit que c'était le dernier", () => {
    expect(completionContent(inHours(48), now)).toBe(
      `${t("bot.answer.completed")}\n${t("bot.answer.nextIn", { delay: "2 jours" })}`,
    );
    expect(completionContent(null, now)).toBe(
      `${t("bot.answer.completed")}\n${t("bot.answer.last")}`,
    );
    expect(completionContent(now, now)).toContain(t("bot.answer.nextSoon"));
  });

  it("arrondit le délai en heures sous un jour, en jours au-delà", () => {
    expect(formatDelay(1)).toBe("1 heure");
    expect(formatDelay(5.4)).toBe("5 heures");
    expect(formatDelay(24)).toBe("1 jour");
    expect(formatDelay(72)).toBe("3 jours");
  });
});
