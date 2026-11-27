import { describe, expect, it } from "vitest";
import {
  OPTIONS_MAX,
  TEXT_ANSWER_MAX,
  nextQuestion,
  parseAnswer,
  questionOptions,
  questionSnapshot,
  type AnswerableQuestion,
  type AnswerInput,
  type QuestionKind,
} from "./answers";

const question = (
  type: QuestionKind,
  patch: Partial<AnswerableQuestion> = {},
): AnswerableQuestion => ({
  type,
  prompt: "Question ?",
  options: type === "SINGLE" || type === "MULTI" ? ["Prix", "Bagages", "Rien"] : null,
  required: true,
  version: 1,
  ...patch,
});

const optional = (type: QuestionKind) => question(type, { required: false });

describe("parseAnswer", () => {
  it("TEXT : texte sans espaces autour, vide refusé si obligatoire, trop long refusé", () => {
    expect(parseAnswer(question("TEXT"), { kind: "text", text: "  Le bouton  " })).toEqual({
      ok: true,
      value: "Le bouton",
    });
    expect(parseAnswer(question("TEXT"), { kind: "text", text: "   " })).toEqual({
      ok: false,
      error: "required",
    });
    expect(parseAnswer(optional("TEXT"), { kind: "text", text: "   " })).toEqual({
      ok: true,
      value: null,
    });
    const long = "a".repeat(TEXT_ANSWER_MAX + 1);
    expect(parseAnswer(question("TEXT"), { kind: "text", text: long })).toEqual({
      ok: false,
      error: "tooLong",
    });
  });

  it("RATING : entier de 1 à 5 seulement", () => {
    expect(parseAnswer(question("RATING"), { kind: "rating", rating: 4 })).toEqual({
      ok: true,
      value: 4,
    });
    for (const rating of [0, 6, 2.5, Number.NaN]) {
      expect(parseAnswer(question("RATING"), { kind: "rating", rating })).toEqual({
        ok: false,
        error: "outOfRange",
      });
    }
  });

  it("YESNO : booléen", () => {
    expect(parseAnswer(question("YESNO"), { kind: "yesno", yes: false })).toEqual({
      ok: true,
      value: false,
    });
  });

  it("SINGLE : le texte du choix, depuis un bouton ou un menu d'un seul choix", () => {
    expect(parseAnswer(question("SINGLE"), { kind: "choice", index: 1 })).toEqual({
      ok: true,
      value: "Bagages",
    });
    expect(parseAnswer(question("SINGLE"), { kind: "choices", indexes: [2] })).toEqual({
      ok: true,
      value: "Rien",
    });
    expect(parseAnswer(question("SINGLE"), { kind: "choice", index: 3 })).toEqual({
      ok: false,
      error: "outOfRange",
    });
    expect(parseAnswer(question("SINGLE"), { kind: "choices", indexes: [0, 1] })).toEqual({
      ok: false,
      error: "outOfRange",
    });
  });

  it("MULTI : textes choisis, sans doublon, dans l'ordre de la question", () => {
    expect(parseAnswer(question("MULTI"), { kind: "choices", indexes: [2, 0, 2] })).toEqual({
      ok: true,
      value: ["Prix", "Rien"],
    });
    expect(parseAnswer(question("MULTI"), { kind: "choices", indexes: [] })).toEqual({
      ok: false,
      error: "required",
    });
    expect(parseAnswer(question("MULTI"), { kind: "choices", indexes: [0, -1] })).toEqual({
      ok: false,
      error: "outOfRange",
    });
  });

  it("les choix sont numérotés comme à l'affichage (textes vides retirés)", () => {
    const q = question("SINGLE", { options: ["", "  Prix ", 3, "Bagages"] });
    expect(parseAnswer(q, { kind: "choice", index: 1 })).toEqual({ ok: true, value: "Bagages" });
  });

  it("passer : null pour une question facultative, refusé pour une obligatoire", () => {
    for (const type of ["TEXT", "RATING", "YESNO", "SINGLE", "MULTI"] as const) {
      expect(parseAnswer(optional(type), { kind: "skip" })).toEqual({ ok: true, value: null });
      expect(parseAnswer(question(type), { kind: "skip" })).toEqual({
        ok: false,
        error: "required",
      });
    }
  });

  it("refuse une réponse d'un autre type que la question", () => {
    const cases: [QuestionKind, AnswerInput][] = [
      ["TEXT", { kind: "rating", rating: 3 }],
      ["RATING", { kind: "yesno", yes: true }],
      ["YESNO", { kind: "text", text: "oui" }],
      ["SINGLE", { kind: "rating", rating: 1 }],
      ["MULTI", { kind: "choice", index: 0 }],
    ];
    for (const [type, input] of cases) {
      expect(parseAnswer(question(type), input)).toEqual({ ok: false, error: "wrongKind" });
    }
  });
});

describe("questionOptions", () => {
  it("garde les textes non vides, sans espaces autour, et 25 au plus, sans les couper", () => {
    expect(questionOptions(["A", "", "  B  ", 3, null])).toEqual(["A", "B"]);
    expect(questionOptions(Array.from({ length: 40 }, (_, i) => `choix ${i}`))).toHaveLength(
      OPTIONS_MAX,
    );
    expect(questionOptions(["c".repeat(200)])[0]).toHaveLength(200);
  });

  it("une valeur mal formée donne une liste vide", () => {
    expect(questionOptions(null)).toEqual([]);
    expect(questionOptions({ a: 1 })).toEqual([]);
    expect(questionOptions("A,B")).toEqual([]);
  });
});

describe("questionSnapshot", () => {
  it("copie le type, l'énoncé, les choix affichés et la version", () => {
    expect(questionSnapshot(question("MULTI", { options: ["A", " ", "B"], version: 3 }))).toEqual({
      type: "MULTI",
      prompt: "Question ?",
      options: ["A", "B"],
      version: 3,
    });
    expect(questionSnapshot(question("RATING", { options: ["ignoré"] }))).toEqual({
      type: "RATING",
      prompt: "Question ?",
      options: null,
      version: 1,
    });
  });
});

describe("nextQuestion", () => {
  const q = (id: string, position: number, archivedAt: Date | null = null) => ({
    id,
    position,
    archivedAt,
  });
  const questions = [q("c", 2), q("a", 0), q("old", 1, new Date("2026-11-20")), q("b", 1)];

  it("donne la première question active sans réponse, avec son rang et le total", () => {
    expect(nextQuestion(questions, new Set())).toEqual({
      question: q("a", 0),
      index: 0,
      number: 1,
      count: 3,
    });
    expect(nextQuestion(questions, new Set(["a"]))).toMatchObject({
      question: { id: "b" },
      index: 1,
      number: 2,
      count: 3,
    });
  });

  it("reprend une question sautée (réponse arrivée par le web dans le désordre)", () => {
    expect(nextQuestion(questions, new Set(["a", "c"]))?.question.id).toBe("b");
  });

  it("renvoie null quand toutes les questions actives ont une réponse", () => {
    expect(nextQuestion(questions, new Set(["a", "b", "c"]))).toBeNull();
    expect(nextQuestion([], new Set())).toBeNull();
  });
});
