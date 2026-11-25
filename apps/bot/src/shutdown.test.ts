import { afterEach, describe, expect, it, vi } from "vitest";
import { createShutdown, type ShutdownStep } from "./shutdown";

function setup(steps: ShutdownStep[], timeoutMs = 1_000) {
  const exit = vi.fn<(code: number) => void>();
  const logError = vi.fn();
  const shutdown = createShutdown(steps, { timeoutMs, exit, log: vi.fn(), logError });
  return { shutdown, exit, logError };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createShutdown", () => {
  it("arrête Discord puis pg-boss, dans l'ordre, et sort avec le code 0", async () => {
    const order: string[] = [];
    const { shutdown, exit } = setup([
      { name: "Discord", run: async () => void order.push("Discord") },
      { name: "pg-boss", run: async () => void order.push("pg-boss") },
    ]);
    await shutdown("SIGTERM");
    expect(order).toEqual(["Discord", "pg-boss"]);
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("ne s'exécute qu'une fois si deux signaux arrivent", async () => {
    const run = vi.fn(async () => {});
    const { shutdown, exit } = setup([{ name: "pg-boss", run }]);
    await Promise.all([shutdown("SIGINT"), shutdown("SIGTERM")]);
    expect(run).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledOnce();
  });

  it("continue après une étape qui échoue, puis sort avec le code 1", async () => {
    const next = vi.fn(async () => {});
    const { shutdown, exit, logError } = setup([
      {
        name: "Discord",
        run: async () => {
          throw new Error("déjà fermé");
        },
      },
      { name: "pg-boss", run: next },
    ]);
    await shutdown("SIGTERM");
    expect(next).toHaveBeenCalledOnce();
    expect(logError).toHaveBeenCalledWith(expect.stringContaining("Discord"), expect.any(Error));
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("force la sortie avec le code 1 si l'arrêt dépasse le délai", async () => {
    vi.useFakeTimers();
    const { shutdown, exit } = setup([{ name: "pg-boss", run: () => new Promise(() => {}) }], 500);
    void shutdown("SIGTERM");
    await vi.advanceTimersByTimeAsync(499);
    expect(exit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });
});
