import { defineConfig, devices } from "@playwright/test";

// Tests de bout en bout du site (e2e/*.spec.ts). Lancer avec `pnpm test:e2e` depuis la racine.
// En local : `next dev` (un serveur déjà lancé sur le port est réutilisé).
// En CI : `next build` puis `next start`, pour tester ce qui sera déployé.
const PORT = Number(process.env.E2E_PORT ?? 3000);
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: isCI ? `pnpm build && pnpm start --port ${PORT}` : `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});
