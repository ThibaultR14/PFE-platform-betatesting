import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 ne charge plus le .env tout seul : on lit celui de la racine du monorepo.
config({ path: path.resolve(import.meta.dirname, "../../.env"), quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Pas env() : il lève une erreur si la variable manque, ce qui casserait `prisma generate` en CI.
    url: process.env.DATABASE_URL ?? "",
  },
});
