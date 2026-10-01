import { prisma } from "./prisma.js";

// Who cancelled each session — latest `session_cancelled` audit wins.
// Covers desk cancels and the adviser-withdrawal auto-cancel cascade
// (whose audit actor is the filing teacher). Sessions never cancelled
// stay absent from the map. One batched query regardless of N.
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
