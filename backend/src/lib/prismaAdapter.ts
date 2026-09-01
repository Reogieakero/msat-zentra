import { PrismaPg } from "@prisma/adapter-pg";

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
  return new PrismaPg({
    connectionString: stripSslMode(url),
    ssl: { rejectUnauthorized: false },
  });
}
