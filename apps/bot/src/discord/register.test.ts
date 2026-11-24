import { describe, expect, it, vi } from "vitest";
import { commands } from "./commands";
import { registerCommands, type CommandsRest } from "./register";

describe("registerCommands", () => {
  it("remplace toutes les commandes globales en un seul PUT", async () => {
    const put = vi.fn<CommandsRest["put"]>(async () => []);
    await registerCommands({ put }, "123456", commands);
    expect(put).toHaveBeenCalledExactlyOnceWith("/applications/123456/commands", {
      body: commands.map((command) => command.data),
    });
  });

  it("transmet l'erreur de Discord (token ou Application ID refusé)", async () => {
    const put = vi.fn<CommandsRest["put"]>(async () => {
      throw new Error("401: Unauthorized");
    });
    await expect(registerCommands({ put }, "123456", commands)).rejects.toThrow("401");
  });
});
