// Point d'entrée de `prisma db seed` (configuré dans prisma.config.ts).
import path from "node:path";
import { config } from "dotenv";
import { createPrismaClient } from "../src/client";
import { seed } from "../src/seed";

config({ path: path.resolve(import.meta.dirname, "../../../.env"), quiet: true });

const prisma = createPrismaClient(process.env.DATABASE_URL ?? "");
try {
  await seed(prisma);
  console.log("Données de démo insérées.");
} finally {
  await prisma.$disconnect();
}
