import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const getDatabaseUrl = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to initialize Prisma.");
  }

  return process.env.DATABASE_URL;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(getDatabaseUrl()),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
