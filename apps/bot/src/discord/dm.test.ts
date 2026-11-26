import { DiscordAPIError, RESTJSONErrorCodes } from "discord.js";
import { describe, expect, it } from "vitest";
import { DmUnavailableError } from "../messaging";
import { toDmError } from "./dm";

function apiError(code: number): DiscordAPIError {
  return new DiscordAPIError(
    { code, message: "refusé" },
    code,
    403,
    "POST",
    "/channels/1/messages",
    {},
  );
}

describe("toDmError", () => {
  it.each([
    RESTJSONErrorCodes.CannotSendMessagesToThisUser,
    RESTJSONErrorCodes.CannotSendMessagesToThisUserDueToHavingNoMutualGuilds,
    RESTJSONErrorCodes.UnknownUser,
  ])("traduit le code %i en DmUnavailableError", (code) => {
    const error = toDmError("42", apiError(code));
    expect(error).toBeInstanceOf(DmUnavailableError);
    expect((error as DmUnavailableError).discordUserId).toBe("42");
  });

  it("laisse passer les autres erreurs, pour qu'elles soient réessayées", () => {
    const other = apiError(RESTJSONErrorCodes.MissingAccess);
    expect(toDmError("42", other)).toBe(other);
    const network = new Error("ECONNRESET");
    expect(toDmError("42", network)).toBe(network);
  });
});
