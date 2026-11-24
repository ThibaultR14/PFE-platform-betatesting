// Avant les tests d'intégration : applique les migrations sur la base de test.
import { execSync } from "node:child_process";

export default function setup(): void {
  execSync("pnpm --filter @microbeta/db run migrate:deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
  });
}
