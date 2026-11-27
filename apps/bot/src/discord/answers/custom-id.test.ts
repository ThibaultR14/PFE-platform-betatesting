import { describe, expect, it } from "vitest";
import { parseCustomId } from "../buttons/custom-id";
import {
  answerButtonId,
  choiceToken,
  NO_TOKEN,
  parseAnswerArg,
  parseQuestionRef,
  ratingToken,
  skipButtonId,
  YES_TOKEN,
} from "./custom-id";

const ref = { assignmentId: "assignment-1", questionId: "question-1", version: 2 };
const argOf = (id: string) => parseCustomId(id).arg;

describe("customId des réponses", () => {
  it("aller-retour d'un bouton de réponse pour chaque valeur", () => {
    expect(parseAnswerArg(argOf(answerButtonId(ref, ratingToken(4))))).toEqual({
      ref,
      input: { kind: "rating", rating: 4 },
    });
    expect(parseAnswerArg(argOf(answerButtonId(ref, YES_TOKEN)))?.input).toEqual({
      kind: "yesno",
      yes: true,
    });
    expect(parseAnswerArg(argOf(answerButtonId(ref, NO_TOKEN)))?.input).toEqual({
      kind: "yesno",
      yes: false,
    });
    expect(parseAnswerArg(argOf(answerButtonId(ref, choiceToken(12))))?.input).toEqual({
      kind: "choice",
      index: 12,
    });
  });

  it("aller-retour de la question visée (Passer, menu, fenêtre)", () => {
    expect(parseCustomId(skipButtonId(ref)).prefix).toBe("skip");
    expect(parseQuestionRef(argOf(skipButtonId(ref)))).toEqual(ref);
  });

  it("refuse un argument mal formé", () => {
    for (const arg of ["", "a:q", "a:q:x", "a::1", "a:q:1:extra"]) {
      expect(parseQuestionRef(arg)).toBeNull();
    }
    for (const arg of ["a:q:1", "a:q:1:peut-etre", "a:q:1:r", "a:q:x:r3", "a:q:1:r3:x"]) {
      expect(parseAnswerArg(arg)).toBeNull();
    }
  });
});
