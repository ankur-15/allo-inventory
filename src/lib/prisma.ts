import { PrismaClient } from "@prisma/client";

// Next.js hot-reload in dev spins up new module instances repeatedly.
// Stashing the client on globalThis avoids spawning hundreds of connections.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}