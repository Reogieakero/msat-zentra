import "dotenv/config";
import { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { createPrismaAdapter } from "./prismaAdapter.js";
import { logger } from "./pino.js";

const RETRYABLE_CODES = new Set(["P1001", "P1002", "P1017", "P2024"]);
const READ_OPERATIONS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

function extendClient(client: PrismaClient) {

  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          if (!READ_OPERATIONS.has(operation)) return query(args);
          try {
            return await query(args);
          } catch (err) {
            if (
              err instanceof Prisma.PrismaClientKnownRequestError &&
              RETRYABLE_CODES.has(err.code)
            ) {
              logger.warn(
                { code: err.code, operation },
                "Database connection dropped mid-query, retrying once"
              );
              await new Promise((r) => setTimeout(r, 250));
              return query(args);
            }
            throw err;
          }
        },
      },
    },
  });
}

type ExtendedPrisma = ReturnType<typeof extendClient>;

const globalForPrisma = globalThis as unknown as {
  prisma?: ExtendedPrisma;
};

function createClient(): ExtendedPrisma {
  return extendClient(
    new PrismaClient({ adapter: createPrismaAdapter() })
  );
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export function disconnectPrisma(): Promise<void> {
  return (prisma as unknown as PrismaClient).$disconnect();
}
