import { prisma } from "../../lib/prisma.js";

export interface RecordsHeatmapQuery {
  termId?: string;
  schoolYearId?: string | null;
  schoolYearName: string;
}

export async function getRecordsHeatmap(query: RecordsHeatmapQuery) {
  const { termId, schoolYearId, schoolYearName } = query;
  const where = termId ? { termId } : {};

  const [sections, rosterEntries, records, followups, referrals] = await Promise.all([
    prisma.section.findMany({
      where: schoolYearId ? { schoolYearId } : {},
      orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        gradeLevel: true,
        students: {
          select: {
            userId: true,
            lrn: true,
            user: { select: { fullName: true, status: true } },
          },
        },
      },
    }),

    prisma.studentRoster.findMany({
      where: schoolYearId ? { schoolYearId } : {},
      select: { id: true, lrn: true, fullName: true, sectionId: true },
    }),
    prisma.anecdotalRecord.findMany({
      where,
      select: {
        id: true,
        studentId: true,
        rosterId: true,
        sectionId: true,
        observationDatetime: true,
        descriptionOfIncident: true,
        notesRecommendationsActions: true,
        category: true,
        confidentialityLevel: true,
        observer: { select: { fullName: true } },
      },
    }),

    prisma.anecdotalRecordFollowup.groupBy({
      by: ["anecdotalRecordId"],
      where: termId ? { anecdotalRecord: { termId } } : {},
      _count: { _all: true },
    }),
    prisma.referral.findMany({
      where: termId ? { anecdotalRecord: { termId } } : {},
      select: { id: true, anecdotalRecordId: true, status: true },
    }),
  ]);

  const latestReferral = new Map<string, { status: string; id: string }>();
  for (const r of referrals) {
    const prev = latestReferral.get(r.anecdotalRecordId);
    if (!prev || r.id > prev.id) latestReferral.set(r.anecdotalRecordId, { status: r.status, id: r.id });
  }
  const hasFollowup = new Set(
    followups.map((f) => f.anecdotalRecordId)
  );

  const keyOf = (r: { studentId: string | null; rosterId: string | null }) =>
    r.rosterId ? `roster:${r.rosterId}` : (r.studentId as string);
  const recordByStudent = new Map<string, typeof records>();
  for (const r of records) {
    const key = keyOf(r);
    const arr = recordByStudent.get(key) ?? [];
    arr.push(r);
    recordByStudent.set(key, arr);
  }
  const rosterBySection = new Map<string, typeof rosterEntries>();
  for (const r of rosterEntries) {
    const arr = rosterBySection.get(r.sectionId) ?? [];
    arr.push(r);
    rosterBySection.set(r.sectionId, arr);
  }

  const toBehavioral = (recs: typeof records) =>
    recs.map((r) => {
      const referral = latestReferral.get(r.id);
      return {
        id: r.id,
        date: r.observationDatetime.toISOString().slice(0, 10),
        category: r.category,
        description: r.descriptionOfIncident,
        severity:
          referral?.status === "resolved"
            ? "Low"
            : r.confidentialityLevel === "confidential"
              ? "High"
              : "Moderate",
        staff: r.observer.fullName,
        resolution: r.notesRecommendationsActions ?? "",
        followUp: referral?.status === "resolved"
          ? "Resolved"
          : hasFollowup.has(r.id)
            ? "Monitoring"
            : "Pending",
      };
    });

  const dataSections = sections
    .map((section) => {
      const profileRows = section.students
        .map((st) => {
          const recs = recordByStudent.get(st.userId);
          if (!recs || recs.length === 0) return null;
          return {
            lrn: st.lrn,
            name: st.user.fullName,
            status: st.user.status,
            gradeLevel: section.gradeLevel,
            section: section.name,
            sectionId: section.id,
            behavioral: toBehavioral(recs),
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

      const rosterRows = (rosterBySection.get(section.id) ?? [])
        .map((st) => {
          const recs = recordByStudent.get(`roster:${st.id}`);
          if (!recs || recs.length === 0) return null;
          return {
            lrn: st.lrn,
            name: st.fullName,
            status: "Enlisted",
            gradeLevel: section.gradeLevel,
            section: section.name,
            sectionId: section.id,
            behavioral: toBehavioral(recs),
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);
      const students = [...profileRows, ...rosterRows];
      if (students.length === 0) return null;
      return {
        sectionId: section.id,
        section: section.name,
        gradeLevel: section.gradeLevel,
        students,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const consumed = new Set<string>();
  for (const section of sections) {
    for (const st of section.students) consumed.add(st.userId);
    for (const r of rosterBySection.get(section.id) ?? []) {
      consumed.add(`roster:${r.id}`);
    }
  }
  const orphanKeys = [...recordByStudent.keys()].filter(
    (k): k is string => typeof k === "string" && !consumed.has(k)
  );

  const nullKeyRecs =
    (recordByStudent as Map<unknown, typeof records>).get(null) ?? [];

  const orphanStudentIds = orphanKeys.filter((k) => !k.startsWith("roster:"));
  const orphanRosterIds = orphanKeys
    .filter((k) => k.startsWith("roster:"))
    .map((k) => k.slice("roster:".length));

  const [orphanProfiles, orphanRosterRows] = await Promise.all([
    orphanStudentIds.length > 0
      ? prisma.studentProfile.findMany({
          where: { userId: { in: orphanStudentIds } },
          select: {
            userId: true,
            lrn: true,
            gradeLevel: true,
            user: { select: { fullName: true, status: true } },
            section: { select: { id: true, name: true } },
          },
        })
      : [],
    orphanRosterIds.length > 0
      ? prisma.studentRoster.findMany({
          where: { id: { in: orphanRosterIds } },
          select: { id: true, lrn: true, fullName: true, gradeLevel: true, sectionId: true },
        })
      : [],
  ]);

  const profileById = new Map(orphanProfiles.map((p) => [p.userId, p]));
  const rosterById = new Map(orphanRosterRows.map((r) => [r.id, r]));
  const sectionById = new Map(sections.map((s) => [s.id, s]));

  type OrphanStudent = {
    lrn: string;
    name: string;
    status: string;
    gradeLevel: string;
    section: string;
    sectionId: string;
    behavioral: ReturnType<typeof toBehavioral>;
  };
  const orphansByGrade = new Map<string, OrphanStudent[]>();
  const pushOrphan = (grade: string, row: OrphanStudent) => {
    const arr = orphansByGrade.get(grade) ?? [];
    arr.push(row);
    orphansByGrade.set(grade, arr);
  };

  for (const key of orphanKeys) {
    const recs = recordByStudent.get(key) ?? [];
    if (recs.length === 0) continue;
    const behavioral = toBehavioral(recs);
    const recSection = sectionById.get(recs[0].sectionId);
    if (key.startsWith("roster:")) {
      const r = rosterById.get(key.slice("roster:".length));
      const grade = String(r?.gradeLevel ?? recSection?.gradeLevel ?? "Unassigned");
      pushOrphan(grade, {
        lrn: r?.lrn || "N/A",
        name: r?.fullName ?? "Unknown student",
        status: "Enlisted",
        gradeLevel: grade,
        section: sectionById.get(r?.sectionId ?? "")?.name ?? recSection?.name ?? "Unassigned",
        sectionId: r?.sectionId ?? recs[0].sectionId ?? "unassigned",
        behavioral,
      });
    } else {
      const p = profileById.get(key);
      const grade = String(p?.gradeLevel ?? recSection?.gradeLevel ?? "Unassigned");
      pushOrphan(grade, {
        lrn: p?.lrn || "N/A",
        name: p?.user.fullName ?? "Unknown student",
        status: p?.user.status ?? "inactive",
        gradeLevel: grade,
        section: p?.section?.name ?? recSection?.name ?? "Unassigned",
        sectionId: p?.section?.id ?? recs[0].sectionId ?? "unassigned",
        behavioral,
      });
    }
  }

  if (nullKeyRecs.length > 0) {
    const recSection = sectionById.get(nullKeyRecs[0].sectionId);
    const grade = String(recSection?.gradeLevel ?? "Unassigned");
    pushOrphan(grade, {
      lrn: "N/A",
      name: "Unknown student",
      status: "inactive",
      gradeLevel: grade,
      section: recSection?.name ?? "Unassigned",
      sectionId: recSection?.id ?? "unassigned",
      behavioral: toBehavioral(nullKeyRecs),
    });
  }

  const orphanSections = [...orphansByGrade.entries()].map(([grade, students]) => ({
    sectionId: `unassigned-${grade}`,
    section: "Unassigned",
    gradeLevel: grade,
    students,
  }));

  return {
    schoolYear: schoolYearName,
    sections: [...dataSections, ...orphanSections],
  };
}
