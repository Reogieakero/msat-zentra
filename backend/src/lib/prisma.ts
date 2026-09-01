import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { createPrismaAdapter } from "./prismaAdapter.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  return new PrismaClient({ adapter: createPrismaAdapter() });
}

export const prisma =
  globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
