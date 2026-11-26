import { describe, expect, it } from "vitest";
import { consentButtonId, customId, parseCustomId } from "./custom-id";

describe("customId", () => {
  it("fait l'aller-retour préfixe et argument", () => {
    expect(parseCustomId(customId("consent", "abc"))).toEqual({ prefix: "consent", arg: "abc" });
  });

  it("garde les « : » de l'argument", () => {
    expect(parseCustomId("pref:a:b")).toEqual({ prefix: "pref", arg: "a:b" });
  });

  it("renvoie un argument vide sans séparateur", () => {
    expect(parseCustomId("seul")).toEqual({ prefix: "seul", arg: "" });
  });

  it("reste sous la limite Discord de 100 caractères pour un cuid", () => {
    expect(consentButtonId("cmi1234567890abcdefghijkl").length).toBeLessThanOrEqual(100);
  });
});
