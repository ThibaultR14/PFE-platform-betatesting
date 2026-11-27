import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import {
  signTesterLink,
  TESTER_LINK_TTL_DAYS,
  testerLinkUrl,
  verifyTesterLink,
} from "./tester-link";

const secret = "s".repeat(32);
const claims = { testerId: "tester-1", assignmentId: "assignment-1" };
const now = new Date("2026-11-27T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("signTesterLink / verifyTesterLink", () => {
  it("retrouve le testeur et l'assignment", async () => {
    const token = await signTesterLink(claims, secret, now);
    expect(await verifyTesterLink(token, secret, now)).toEqual(claims);
  });

  it("reste valable jusqu'à l'expiration, puis est refusé", async () => {
    const token = await signTesterLink(claims, secret, now);
    const justBefore = new Date(now.getTime() + TESTER_LINK_TTL_DAYS * DAY_MS - 1_000);
    const after = new Date(now.getTime() + TESTER_LINK_TTL_DAYS * DAY_MS + 1_000);
    expect(await verifyTesterLink(token, secret, justBefore)).toEqual(claims);
    expect(await verifyTesterLink(token, secret, after)).toBeNull();
  });

  it("refuse un jeton modifié", async () => {
    const token = await signTesterLink(claims, secret, now);
    // Même signature, mais le contenu désigne un autre testeur.
    const [header, , signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "autre", assignmentId: "x" })).toString(
      "base64url",
    );
    expect(await verifyTesterLink(`${header}.${forged}.${signature}`, secret, now)).toBeNull();
  });

  it("refuse un jeton signé avec un autre secret", async () => {
    const token = await signTesterLink(claims, "t".repeat(32), now);
    expect(await verifyTesterLink(token, secret, now)).toBeNull();
  });

  it("refuse un jeton signé pour un autre usage", async () => {
    const token = await new SignJWT({ assignmentId: "assignment-1" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("tester-1")
      .setAudience("autre-usage")
      .setExpirationTime(new Date(now.getTime() + DAY_MS))
      .sign(new TextEncoder().encode(secret));
    expect(await verifyTesterLink(token, secret, now)).toBeNull();
  });

  it("refuse un jeton sans assignment", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("tester-1")
      .setAudience("tester-link")
      .setExpirationTime(new Date(now.getTime() + DAY_MS))
      .sign(new TextEncoder().encode(secret));
    expect(await verifyTesterLink(token, secret, now)).toBeNull();
  });

  it("refuse n'importe quelle chaîne", async () => {
    expect(await verifyTesterLink("pas-un-jeton", secret, now)).toBeNull();
  });

  it("rejette un secret trop court", async () => {
    await expect(signTesterLink(claims, "court", now)).rejects.toThrow("TESTER_LINK_SECRET");
    await expect(verifyTesterLink("x", "court", now)).rejects.toThrow("TESTER_LINK_SECRET");
  });
});

describe("testerLinkUrl", () => {
  it("construit l'URL de la page web testeur", () => {
    expect(testerLinkUrl("https://microbeta.app", "abc")).toBe("https://microbeta.app/t/abc");
  });
});
