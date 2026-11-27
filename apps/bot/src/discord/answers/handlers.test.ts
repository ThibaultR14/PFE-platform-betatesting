import type { QuestionModel } from "@microbeta/db";
import { t } from "@microbeta/i18n";
import { ComponentType, MessageFlags } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import type { DmMessage } from "../../messaging";
import type { AnswerRequest, RecordAnswerResult } from "../../microtest/answer";
import { answerText, completionContent } from "../../microtest/message";
import {
  fakeButtonInteraction,
  fakeModalInteraction,
  fakeSelectInteraction,
} from "../fake-interaction";
import {
  answerButton,
  pickSelect,
  skipButton,
  textModal,
  writeButton,
  type AnswerDeps,
} from "./handlers";

const ephemeral = (content: string) => ({ content, flags: MessageFlags.Ephemeral });
const now = new Date("2026-11-27T12:00:00Z");
const TESTER = "300000000000000001";

const nextQuestionRow: QuestionModel = {
  id: "q2",
  microTestId: "mt1",
  position: 1,
  type: "YESNO",
  prompt: "As-tu trouvé le bouton ?",
  options: null,
  required: true,
  version: 1,
  archivedAt: null,
  createdAt: now,
  updatedAt: now,
};

const recordedThenQuestion: RecordAnswerResult = {
  status: "recorded",
  testerId: "tester-1",
  value: 4,
  then: {
    kind: "question",
    step: { question: nextQuestionRow, index: 1, number: 2, count: 3 },
  },
};

function deps(result: RecordAnswerResult) {
  const record = vi.fn(async (_request: AnswerRequest) => result);
  const webLink = vi.fn(async () => "https://microbeta.app/t/jeton");
  const send = vi.fn(async (_discordUserId: string, _message: DmMessage) => {});
  const answerDeps: AnswerDeps = { record, webLink, dm: { send }, now: () => now };
  return { answerDeps, record, webLink, send };
}

describe("bouton de réponse", () => {
  it("enregistre la réponse, retire les boutons et pose la question suivante en privé", async () => {
    const { answerDeps, record, webLink, send } = deps(recordedThenQuestion);
    const { interaction, update, followUp } = fakeButtonInteraction("ans:a1:q1:3:r4", {
      messageContent: "**Question 1/3**",
    });

    await answerButton(answerDeps).execute(interaction, "a1:q1:3:r4");

    expect(record).toHaveBeenCalledExactlyOnceWith({
      assignmentId: "a1",
      questionId: "q1",
      version: 3,
      discordUserId: TESTER,
      input: { kind: "rating", rating: 4 },
    });
    expect(update).toHaveBeenCalledExactlyOnceWith({
      content: `**Question 1/3**\n\n${answerText(4)}`,
      components: [],
    });
    expect(webLink).toHaveBeenCalledWith("tester-1", "a1");
    // Message privé normal, pas une suite de l'interaction (que Discord afficherait en réponse).
    expect(followUp).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledOnce();
    const [to, next] = send.mock.calls[0] ?? [];
    expect(to).toBe(TESTER);
    expect(next?.content).toContain(t("bot.microtest.questionHeader", { number: 2, count: 3 }));
    expect(next?.content).toContain("As-tu trouvé le bouton ?");
    expect(JSON.stringify(next)).toContain("ans:a1:q2:1:yes");
  });

  it("dernière question : message de fin avec la date du suivant", async () => {
    const nextAt = new Date("2026-11-29T12:00:00Z");
    const { answerDeps, send } = deps({
      status: "recorded",
      testerId: "tester-1",
      value: true,
      then: { kind: "completed", nextAt },
    });
    const { interaction } = fakeButtonInteraction("ans:a1:q1:1:yes");

    await answerButton(answerDeps).execute(interaction, "a1:q1:1:yes");

    expect(send).toHaveBeenCalledExactlyOnceWith(TESTER, {
      content: completionContent(nextAt, now),
      components: [],
    });
  });

  it("clic sur une question déjà répondue : ignoré poliment, le message ne change pas", async () => {
    const { answerDeps, send } = deps({ status: "alreadyAnswered" });
    const { interaction, reply, update } = fakeButtonInteraction("ans:a1:q1:1:r2");

    await answerButton(answerDeps).execute(interaction, "a1:q1:1:r2");

    expect(reply).toHaveBeenCalledExactlyOnceWith(ephemeral(t("bot.answer.alreadyAnswered")));
    expect(update).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ["alreadyCompleted", "bot.answer.alreadyCompleted"],
    ["optedOut", "bot.answer.optedOut"],
    ["notYou", "bot.answer.notYou"],
    ["unknownAssignment", "bot.answer.unknown"],
    ["notSent", "bot.answer.unknown"],
  ] as const)("%s : réponse éphémère", async (status, key) => {
    const { answerDeps } = deps({ status });
    const { interaction, reply, update } = fakeButtonInteraction("ans:a1:q1:1:r2");
    await answerButton(answerDeps).execute(interaction, "a1:q1:1:r2");
    expect(reply).toHaveBeenCalledExactlyOnceWith(ephemeral(t(key)));
    expect(update).not.toHaveBeenCalled();
  });

  it("réponse refusée par core : réponse éphémère", async () => {
    const { answerDeps } = deps({ status: "invalid", error: "outOfRange" });
    const { interaction, reply } = fakeButtonInteraction("ans:a1:q1:1:r9");
    await answerButton(answerDeps).execute(interaction, "a1:q1:1:r9");
    expect(reply).toHaveBeenCalledExactlyOnceWith(ephemeral(t("bot.answer.invalid")));
  });

  it("question modifiée depuis l'envoi : boutons retirés, question à jour reposée", async () => {
    const { answerDeps, send } = deps({
      status: "stale",
      testerId: "tester-1",
      then: recordedThenQuestion.then,
    });
    const { interaction, update } = fakeButtonInteraction("ans:a1:q1:1:r2", {
      messageContent: "Ancienne version",
    });

    await answerButton(answerDeps).execute(interaction, "a1:q1:1:r2");

    expect(update).toHaveBeenCalledExactlyOnceWith({
      content: `Ancienne version\n\n${t("bot.answer.stale")}`,
      components: [],
    });
    expect(send.mock.calls[0]?.[1].content).toContain("As-tu trouvé le bouton ?");
  });

  it("customId mal formé : rien n'est enregistré", async () => {
    const { answerDeps, record } = deps(recordedThenQuestion);
    const { interaction, reply } = fakeButtonInteraction("ans:n-importe-quoi");
    await answerButton(answerDeps).execute(interaction, "n-importe-quoi");
    expect(record).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledExactlyOnceWith(ephemeral(t("bot.errors.unknownButton")));
  });
});

describe("bouton « Passer »", () => {
  it("enregistre une question passée", async () => {
    const { answerDeps, record } = deps({ ...recordedThenQuestion, value: null });
    const { interaction, update } = fakeButtonInteraction("skip:a1:q1:1", {
      messageContent: "Question",
    });

    await skipButton(answerDeps).execute(interaction, "a1:q1:1");

    expect(record.mock.calls[0]?.[0].input).toEqual({ kind: "skip" });
    expect(update.mock.calls[0]?.[0].content).toBe(`Question\n\n${t("bot.answer.skipped")}`);
  });
});

describe("question TEXT", () => {
  it("« Répondre » ouvre la fenêtre de saisie, sans rien enregistrer", async () => {
    const { interaction, showModal, reply } = fakeButtonInteraction("text:a1:q1:2");

    await writeButton().execute(interaction, "a1:q1:2");

    const modal = showModal.mock.calls[0]?.[0];
    expect(modal?.custom_id).toBe("textm:a1:q1:2");
    expect(modal?.title).toBe(t("bot.answer.modalTitle"));
    expect(JSON.stringify(modal?.components)).toContain('"custom_id":"answer"');
    expect(JSON.stringify(modal?.components)).toContain(`"type":${ComponentType.Label}`);
    expect(reply).not.toHaveBeenCalled();
  });

  it("« Répondre » avec un customId mal formé : réponse éphémère", async () => {
    const { interaction, showModal, reply } = fakeButtonInteraction("text:x");
    await writeButton().execute(interaction, "x");
    expect(showModal).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledOnce();
  });

  it("l'envoi de la fenêtre enregistre le texte saisi", async () => {
    const { answerDeps, record } = deps({ ...recordedThenQuestion, value: "Le menu" });
    const { interaction, update } = fakeModalInteraction("textm:a1:q1:2", { answer: "Le menu" });

    await textModal(answerDeps).execute(interaction, "a1:q1:2");

    expect(record.mock.calls[0]?.[0]).toMatchObject({
      questionId: "q1",
      version: 2,
      input: { kind: "text", text: "Le menu" },
    });
    expect(update).toHaveBeenCalledOnce();
  });
});

describe("menu de sélection", () => {
  it("envoie les numéros des choix sélectionnés", async () => {
    const { answerDeps, record } = deps({ ...recordedThenQuestion, value: ["Prix", "Rien"] });
    const { interaction } = fakeSelectInteraction("pick:a1:q1:1", ["0", "2"]);

    await pickSelect(answerDeps).execute(interaction, "a1:q1:1");

    expect(record.mock.calls[0]?.[0].input).toEqual({ kind: "choices", indexes: [0, 2] });
  });
});
