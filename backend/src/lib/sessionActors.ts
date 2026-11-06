import { prisma } from "./prisma.js";

export async function sessionCancelledByRole(
  sessionIds: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (sessionIds.length === 0) return out;
  const logs = await prisma.auditLog.findMany({
    where: {
      sourceTable: "counseling_sessions",
      sourceId: { in: sessionIds },
      actionType: "session_cancelled",
    },
    select: { sourceId: true, user: { select: { role: true } } },
    orderBy: { createdAt: "desc" },
  });
  for (const log of logs) {
    if (!out.has(log.sourceId)) {
      out.set(log.sourceId, String(log.user?.role ?? ""));
    }
  }
  return out;
}
