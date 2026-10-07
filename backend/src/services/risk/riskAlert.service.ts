import { prisma } from "../../lib/prisma.js";
import { fanoutToRole } from "../../lib/notify.js";

export interface AlertGuidanceResult {
  alerted: boolean;
  code?: string;
  message?: string;
}

// Principal: alert guidance counselors about an at-risk student with no
// intervention action yet. Read-only tracking otherwise — the principal never
// edits interventions. Fans out to every active guidance counselor.
export async function alertGuidance(
  ctx: { userId: string },
  rawId: string,
  note: string,
): Promise<AlertGuidanceResult> {
  const isRoster = rawId.startsWith("roster:");
  const trimmedNote = note.trim().slice(0, 500);

  const [profile, roster, existing] = await Promise.all([
    !isRoster
      ? prisma.studentProfile.findUnique({
          where: { userId: rawId },
          select: {
            lrn: true,
            user: { select: { fullName: true } },
            section: { select: { name: true } },
          },
        })
      : null,
    isRoster
      ? prisma.studentRoster.findUnique({
          where: { id: rawId.slice("roster:".length) },
          select: {
            lrn: true,
            fullName: true,
            section: { select: { name: true } },
          },
        })
      : null,
    prisma.intervention.findFirst({
      where: isRoster
        ? { rosterId: rawId.slice("roster:".length) }
        : { studentId: rawId },
      select: { id: true, outcomeStatus: true },
    }),
  ]);

  if (!profile && !roster) {
    return { alerted: false, code: "NOT_FOUND", message: "Student not found" };
  }
  if (existing && existing.outcomeStatus !== "unresolved") {
    return {
      alerted: false,
      code: "INTERVENTION_EXISTS",
      message: "Guidance already has action on this case.",
    };
  }

  const name = profile?.user.fullName ?? roster?.fullName ?? "Unknown student";
  const lrn = profile?.lrn ?? roster?.lrn ?? "";
  const section = profile?.section?.name ?? roster?.section?.name ?? "";
  const message =
    `Principal flagged ${name}${lrn ? ` (LRN ${lrn})` : ""}${section ? ` of ${section}` : ""} — no intervention action yet.` +
    (trimmedNote ? ` Note: ${trimmedNote}` : "");

  // Best-effort fanout after responding (never delays the response).
  void fanoutToRole("guidance_counselor", {
    sourceTable: "interventions",
    action: "principal_alert",
    message,
    sourceId: rawId,
    excludeUserId: ctx.userId,
  });
  return { alerted: true };
}
