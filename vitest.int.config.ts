// Tests d'intégration (*.int.test.ts) : ils tournent sur une vraie base Postgres, TEST_DATABASE_URL.
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ quiet: true });

const testUrl = process.env.TEST_DATABASE_URL ?? "";

/** Nom de la base dans une URL Postgres, "" si l'URL est invalide. */
function databaseName(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.slice(1));
  } catch {
    return "";
  }
}

// Garde-fou : ces tests vident la base, ils ne doivent jamais viser la base de dev.
// On vérifie le NOM de la base, pas toute l'URL (un hôte « test-server » ne suffit pas).
if (!databaseName(testUrl).includes("test")) {
  throw new Error(
    `TEST_DATABASE_URL doit viser une base dont le nom contient "test" (ex. microbeta_test). Base reçue : "${databaseName(testUrl)}"`,
  );
}

export default defineConfig({
  test: {
    include: ["{apps,packages}/*/src/**/*.int.test.ts"],
    environment: "node",
    globalSetup: ["./vitest.int.setup.ts"],
    env: { DATABASE_URL: testUrl },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
