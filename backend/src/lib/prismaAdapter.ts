import { PrismaPg } from "@prisma/adapter-pg";
import { logger } from "./pino.js";

function stripSslMode(url: string): string {
  const qIdx = url.indexOf("?");
  if (qIdx === -1) return url;
  const base = url.slice(0, qIdx);
  const query = url.slice(qIdx + 1);
  const parts = query.split("&").filter((p) => p && !p.startsWith("sslmode="));
  return parts.length ? `${base}?${parts.join("&")}` : base;
}

export function createPrismaAdapter(connectionString?: string): PrismaPg {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return new PrismaPg(
    {
      connectionString: stripSslMode(url),
      ssl: { rejectUnauthorized: false },
      // Supabase's pooler closes connections server-side without warning;
      // a query that reuses the dead socket fails with "Connection
      // terminated unexpectedly". Recycle sockets before the pooler kills
      // them and detect dead ones with TCP keepalive so this never
      // surfaces to requests.
      max: 10,
      connectionTimeoutMillis: 15_000,
      idleTimeoutMillis: 30_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
    },
    {
      // Idle-client errors otherwise arrive as unhandled 'error' events
      // and crash the process. Log them instead — the pool replaces the
      // dead client automatically.
      onPoolError: (err) => {
        logger.error({ err: err?.message ?? err }, "Database pool error");
      },
    },
  );
}
