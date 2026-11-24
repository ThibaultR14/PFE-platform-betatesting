import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

/** Crée un client Prisma (Postgres via node-pg) pour l'URL donnée. */
export function createPrismaClient(connectionString: string): PrismaClient {
  if (!connectionString) {
    throw new Error("DATABASE_URL manquante : copiez .env.example en .env (voir CLAUDE.md).");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Un seul client par process. En dev, Next.js recharge les modules à chaud : on garde
// l'instance sur globalThis pour ne pas ouvrir un nouveau pool à chaque rechargement.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Client partagé, créé au premier accès à partir de `process.env.DATABASE_URL`. */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient(process.env.DATABASE_URL ?? "");
  }
  return globalForPrisma.prisma;
}
