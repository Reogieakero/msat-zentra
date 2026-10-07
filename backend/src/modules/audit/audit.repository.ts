import { prisma } from "../../lib/prisma.js";

// Shared audit data-access: batched source-label resolution for the log
// list. Single-table reads for the status-only drill-down live in the audit
// service (one query per source type, no fan-out).

export const MAX_PAGE_SIZE = 100;

// Batched label resolution: groups entries by source table and issues one
// findMany per table (+ one studentProfile lookup), instead of 1-2 findUnique
// per row (N+1). Falls back to "table #id" when not resolvable.
export async function resolveSourceLabels(
  entries: { sourceTable: string; sourceId: string }[],
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  const key = (t: string, id: string) => `${t.toLowerCase()}::${id}`;
  try {
    const byTable = new Map<string, string[]>();
    for (const e of entries) {
      const t = e.sourceTable.toLowerCase();
      if (!byTable.has(t)) byTable.set(t, []);
      if (!byTable.get(t)!.includes(e.sourceId)) byTable.get(t)!.push(e.sourceId);
    }

    const studentNameById = new Map<string, string>();
    const collectStudentIds: string[] = [];

    // First pass: bulk-fetch source rows per table (select studentId/roster only).
    const sourceStudent = new Map<string, string | null>();
    const sourceRoster = new Map<string, string | null>();
    for (const [table, ids] of byTable) {
      try {
        if (table === "adm_learner_profiles") {
          const rows = await prisma.admLearnerProfile.findMany({
            where: { id: { in: ids } },
            select: { id: true, studentId: true },
          });
          for (const r of rows) {
            sourceStudent.set(key(table, r.id), r.studentId ?? null);
            if (r.studentId) collectStudentIds.push(r.studentId);
          }
        } else if (table === "health_records") {
          const rows = await prisma.healthRecord.findMany({
            where: { id: { in: ids } },
            select: { id: true, studentId: true },
          });
          for (const r of rows) {
            sourceStudent.set(key(table, r.id), r.studentId ?? null);
            if (r.studentId) collectStudentIds.push(r.studentId);
          }
        } else if (table === "home_visitation_records") {
          const rows = await prisma.homeVisitationRecord.findMany({
            where: { id: { in: ids } },
            select: { id: true, studentId: true },
          });
          for (const r of rows) {
            sourceStudent.set(key(table, r.id), r.studentId ?? null);
            if (r.studentId) collectStudentIds.push(r.studentId);
          }
        } else if (
          table === "anecdotal_records" ||
          table === "interventions" ||
          table === "referrals" ||
          table === "final_grades"
        ) {
          const model =
            table === "anecdotal_records"
              ? prisma.anecdotalRecord
              : table === "interventions"
                ? prisma.intervention
                : table === "referrals"
                  ? prisma.referral
                  : prisma.finalGrade;
          const rows = await (model as any).findMany({
            where: { id: { in: ids } },
            select: { id: true, studentId: true, roster: { select: { fullName: true } } },
          });
          for (const r of rows) {
            sourceStudent.set(key(table, r.id), r.studentId ?? null);
            sourceRoster.set(key(table, r.id), r.roster?.fullName ?? null);
            if (r.studentId) collectStudentIds.push(r.studentId);
          }
        } else if (table === "sf10_records") {
          const rows = await prisma.sf10Record.findMany({
            where: { id: { in: ids } },
            select: { id: true, studentId: true },
          });
          for (const r of rows) {
            sourceStudent.set(key(table, r.id), r.studentId ?? null);
            if (r.studentId) collectStudentIds.push(r.studentId);
          }
        } else if (table === "student_profiles" || table === "studentprofile") {
          const rows = await prisma.studentProfile.findMany({
            where: { userId: { in: ids } },
            include: { user: { select: { fullName: true } } },
          });
          for (const r of rows) studentNameById.set(r.userId, r.user.fullName);
        } else if (table === "users") {
          const rows = await prisma.user.findMany({
            where: { id: { in: ids } },
            select: {
              id: true,
              fullName: true,
              email: true,
              studentProfile: { select: { userId: true } },
            },
          });
          for (const r of rows) {
            const name = r.fullName || r.email;
            labels.set(key(table, r.id), r.studentProfile ? `Student · ${name}` : name);
          }
        } else if (table === "school_years") {
          const rows = await prisma.schoolYear.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true },
          });
          for (const r of rows) labels.set(key(table, r.id), r.name);
        }
      } catch {
        // Per-table failure falls back to "table #id" below.
      }
    }

    if (collectStudentIds.length > 0) {
      const uniq = Array.from(new Set(collectStudentIds));
      const profiles = await prisma.studentProfile.findMany({
        where: { userId: { in: uniq } },
        include: { user: { select: { fullName: true } } },
      });
      for (const p of profiles) studentNameById.set(p.userId, p.user.fullName);
    }

    const prefixFor = (table: string) => {
      switch (table) {
        case "adm_learner_profiles":
          return "ADM";
        case "health_records":
          return "Health";
        case "home_visitation_records":
          return "Home Visit";
        case "anecdotal_records":
          return "Anecdotal";
        case "interventions":
          return "Intervention";
        case "referrals":
          return "Referral";
        case "sf10_records":
          return "SF10";
        case "final_grades":
          return "Final Grade";
        default:
          return null;
      }
    };

    for (const e of entries) {
      const k = key(e.sourceTable, e.sourceId);
      if (labels.has(k)) continue;
      const table = e.sourceTable.toLowerCase();
      const prefix = prefixFor(table);
      if (prefix) {
        const sid = sourceStudent.get(k);
        const profileName = sid ? (studentNameById.get(sid) ?? null) : null;
        const rosterName = sourceRoster.get(k) ?? null;
        const resolved = profileName ?? rosterName;
        labels.set(k, resolved ? `${prefix} · ${resolved}` : `${e.sourceTable} #${e.sourceId}`);
      } else if (!labels.has(k)) {
        labels.set(k, `${e.sourceTable} #${e.sourceId}`);
      }
    }
  } catch {
    // Fallback handled by caller.
  }
  return labels;
}
