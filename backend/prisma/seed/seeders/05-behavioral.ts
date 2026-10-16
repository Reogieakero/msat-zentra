import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { T2_CUTOFF, DRY } from "../config.js";
import type { CoreCtx } from "./00-core.js";
import type { AcademicCtx } from "./01-academic.js";
import type { RosterCtx } from "./02-roster.js";
import type { Rng } from "../utils/rng.js";
import { keyId } from "../utils/rng.js";
import { inTermDate } from "../utils/calendar.js";
import { bulkCreate, Batcher } from "../utils/chunk.js";

export interface BehavioralCtx {
  anecdotalAll: { id: string; studentKey: string; studentId: string | null; rosterId: string | null; sectionId: string; termId: string; observerId: string }[];
  referrals: { id: string; studentKey: string; studentId: string | null; rosterId: string | null; termId: string; role: string; status: string; anecdotalId: string }[];
  anecdotalCount: Map<string, number>; // `${termId}|${studentKey}` -> count
}

const INCIDENTS: Record<string, string[]> = {
  behavioral: [
    "Disruptive behavior during class discussion; redirected twice",
    "Verbal altercation with a classmate during recess; mediated on-site",
    "Unauthorized use of mobile phone during lesson",
    "Sleeping during morning session; checked for wellness",
  ],
  bullying: ["Peer conflict reported by classmate; both parties interviewed", "Exclusion incident in group activity; facilitated restorative talk"],
  academic: [
    "Late submission of assignments for three consecutive days",
    "Incomplete homework without prior notice; parent contacted",
    "Academic dishonesty during quiz; paper invalidated per policy",
  ],
  attendance: ["Frequent tardiness without excuse slip; attendance contract discussed", "Unexplained absence pattern over two weeks; home contacted"],
  health: ["Student reported dizziness during flag ceremony; referred to clinic", "Minor injury during P.E.; first aid given, observed"],
};

const LOCATIONS = ["Classroom", "Canteen", "Covered Court", "Corridor", "Library", "School Gate", "Laboratory"];

export async function seedBehavioral(
  prisma: PrismaClient,
  core: CoreCtx,
  acad: AcademicCtx,
  roster: RosterCtx,
  rng: Rng,
): Promise<BehavioralCtx> {
  const anecdotalAll: BehavioralCtx["anecdotalAll"] = [];
  const referrals: BehavioralCtx["referrals"] = [];
  const anecdotalCount = new Map<string, number>();
  if (DRY) return { anecdotalAll, referrals, anecdotalCount };

  const t1 = core.termIds.find((t) => t.n === 1)!;
  const t2 = core.termIds.find((t) => t.n === 2)!;
  const secById = acad.sectionById;
  const userIdByLrn = new Map(roster.profiles.map((p) => [p.lrn, p.userId]));
  const sectionOfRoster = new Map(roster.rosterAll.map((r) => [r.id, r.sectionId]));

  // ---- Anecdotal: ~16% of students get 1-3 records ----
  const batcher = new Batcher("Anecdotal", 1000, (ch) => prisma.anecdotalRecord.createMany({ data: ch }) as any);
  const allStudentKeys: { key: string; studentId: string | null; rosterId: string | null; sectionId: string }[] = [];
  for (const r of roster.rosterAll) {
    const uid = userIdByLrn.get(r.lrn);
    allStudentKeys.push({ key: uid ? `S:${uid}` : `R:${r.id}`, studentId: uid ?? null, rosterId: uid ? null : r.id, sectionId: r.sectionId });
  }
  const shuffled = rng.shuffle(allStudentKeys);
  const targetCount = Math.floor(shuffled.length * 0.16);
  const cats = ["behavioral", "bullying", "academic", "attendance", "health"] as const;
  const catW = [0.34, 0.1, 0.24, 0.2, 0.12];

  let ai = 0;
  for (let i = 0; i < targetCount; i++) {
    const s = shuffled[i];
    const nRec = rng.weighted([1, 2, 3], [0.65, 0.25, 0.1]);
    for (let k = 0; k < nRec; k++) {
      const termId = rng.next() < 0.62 ? core.t1Id : core.t2Id;
      const term = termId === core.t1Id ? t1 : t2;
      const cat = rng.weighted([...cats], catW);
      const sec = secById.get(s.sectionId);
      const observerId = rng.next() < 0.7 ? (sec?.adviserId ?? core.principalId) : rng.pick(acad.allTeachers).id;
      const row: any = {
        ...(s.studentId ? { studentId: s.studentId } : { rosterId: s.rosterId }),
        observerId,
        sectionId: s.sectionId,
        observationDatetime: inTermDate(rng, term.start, term.end, termId === core.t2Id ? T2_CUTOFF : undefined),
        descriptionOfIncident: rng.pick(INCIDENTS[cat]),
        descriptionOfLocation: rng.pick(LOCATIONS),
        notesRecommendationsActions: rng.pick([
          "Monitor and counsel; coordinate with parents.",
          "Referred for follow-up conference with adviser.",
          "Behavior contract discussed; review in two weeks.",
          "Parent communication sent; improvement observed.",
        ]),
        classPerformance: rng.next() < 0.4 ? "Satisfactory; needs consistency in submissions." : null,
        attendanceSummary: rng.next() < 0.4 ? "Attendance within normal range." : null,
        termId,
        category: cat as any,
        confidentialityLevel: rng.next() < 0.85 ? ("restricted" as const) : ("confidential" as const),
      };
      await batcher.push(row);
      ai++;
      const ck = `${termId}|${s.key}`;
      anecdotalCount.set(ck, (anecdotalCount.get(ck) ?? 0) + 1);
    }
  }
  await batcher.finish();

  const anecRows = await prisma.anecdotalRecord.findMany({
    where: { termId: { in: [core.t1Id, core.t2Id] } },
    select: { id: true, studentId: true, rosterId: true, sectionId: true, termId: true, observerId: true },
  });
  for (const a of anecRows) {
    const key = a.studentId ? `S:${a.studentId}` : `R:${a.rosterId}`;
    anecdotalAll.push({ id: a.id, studentKey: key, studentId: a.studentId, rosterId: a.rosterId, sectionId: a.sectionId, termId: a.termId, observerId: a.observerId });
  }

  // ---- Folders: 1-2 per teacher ----
  {
    const owners = [...acad.advisers.map((a) => a.id), ...acad.subjectTeachers.map((t) => t.id)];
    const rows: any[] = [];
    for (const oid of owners) {
      const n = rng.weighted([0, 1, 2], [0.2, 0.55, 0.25]);
      for (let k = 0; k < n; k++) {
        rows.push({ id: keyId("afol", `${oid.slice(-6)}_${k}`), ownerId: oid, name: rng.pick(["Behavior", "Attendance Watch", "Academic Concerns", "Parent Comms", "Follow-ups"] as const) + ` ${k + 1}` });
      }
    }
    await bulkCreate("AnecdotalFolders", rows.length, (ch) => prisma.anecdotalFolder.createMany({ data: ch, skipDuplicates: true }) as any, rows, 1000);
    // Assign 30% of anecdotal rows to a folder of their observer.
    const folders = await prisma.anecdotalFolder.findMany({ select: { id: true, ownerId: true } });
    const folderByOwner = new Map<string, string[]>();
    for (const f of folders) {
      const a = folderByOwner.get(f.ownerId) ?? [];
      a.push(f.id);
      folderByOwner.set(f.ownerId, a);
    }
    const toUpdate = anecRows.filter(() => rng.next() < 0.3);
    for (let i = 0; i < toUpdate.length; i += 500) {
      const ch = toUpdate.slice(i, i + 500);
      await Promise.all(
        ch.map((a) => {
          const pool = folderByOwner.get(a.observerId);
          if (!pool?.length) return Promise.resolve();
          return prisma.anecdotalRecord.update({ where: { id: a.id }, data: { folderId: rng.pick(pool) } }).catch(() => {});
        }),
      );
    }
  }

  // ---- Followups: 35% of anecdotal get 1-2 ----
  {
    const batcherF = new Batcher("AnecdotalFollowups", 1000, (ch) => prisma.anecdotalRecordFollowup.createMany({ data: ch }) as any);
    for (const a of anecdotalAll) {
      if (rng.next() > 0.35) continue;
      const n = rng.next() < 0.8 ? 1 : 2;
      const term = a.termId === core.t1Id ? t1 : t2;
      for (let k = 0; k < n; k++) {
        await batcherF.push({
          anecdotalRecordId: a.id,
          followupBy: a.observerId,
          followupDate: inTermDate(rng, term.start, term.end, a.termId === core.t2Id ? T2_CUTOFF : undefined),
          notes: rng.pick(["Followed up with student; improvement noted.", "Parent conference held; agreed on support plan.", "Re-observed; behavior stable, continue monitoring."]),
        });
      }
    }
    await batcherF.finish();
  }

  // ---- Referrals: ~30% of anecdotal ----
  {
    const candidates = rng.shuffle(anecdotalAll).slice(0, Math.floor(anecdotalAll.length * 0.32));
    const batcherR = new Batcher("Referrals", 1000, (ch) => prisma.referral.createMany({ data: ch }) as any);
    // Track open ADM per student+term to respect ADM_CASE_EXISTS.
    const openAdm = new Set<string>();
    for (const a of candidates) {
      const role = rng.weighted(["guidance_counselor", "nurse", "adm_coordinator", "principal"], [0.4, 0.25, 0.25, 0.1]);
      if (role === "adm_coordinator") {
        const k = `${a.termId}|${a.studentKey}`;
        if (openAdm.has(k)) continue; // only one open ADM per student per term
        openAdm.add(k);
      }
      const status = rng.weighted(["pending", "in_progress", "resolved", "escalated", "follow_up", "dismissed", "info_requested"], [0.3, 0.25, 0.22, 0.06, 0.07, 0.05, 0.05]);
      const row: any = {
        anecdotalRecordId: a.id,
        referredToRole: role as any,
        referredBy: a.observerId,
        reason: rng.pick([
          "Behavioral concern requiring specialist review.",
          "Attendance pattern needs guidance assessment.",
          "Academic decline observed; request evaluation.",
          "Wellness concern noted during observation.",
        ]),
        consultReviewer: role === "adm_coordinator" ? rng.pick(["nurse", "guidance_counselor", "lrpc"] as const) : null,
        referralFormReady: role === "nurse" || role === "adm_coordinator" ? rng.next() < 0.5 : false,
        status: status as any,
        notes: rng.next() < 0.4 ? "Initial triage notes filed." : null,
        ...(a.studentId ? { studentId: a.studentId } : { rosterId: a.rosterId }),
        termId: a.termId,
      };
      if (status === "resolved") {
        row.resolutionSummary = "Case reviewed; intervention completed with parent coordination.";
        row.resolvedAt = inTermDate(rng, t1.start, t1.end);
      }
      if (status === "escalated") {
        row.escalationReason = "Requires higher-level review.";
        row.escalatedTo = "principal";
      }
      if (status === "follow_up") row.followUpDate = inTermDate(rng, t1.start, t1.end);
      await batcherR.push(row);
    }
    await batcherR.finish();
  }

  const refRows = await prisma.referral.findMany({
    where: { termId: { in: [core.t1Id, core.t2Id] } },
    select: { id: true, studentId: true, rosterId: true, termId: true, referredToRole: true, status: true, anecdotalRecordId: true },
  });
  for (const r of refRows) {
    referrals.push({
      id: r.id,
      studentKey: r.studentId ? `S:${r.studentId}` : `R:${r.rosterId}`,
      studentId: r.studentId,
      rosterId: r.rosterId,
      termId: r.termId,
      role: r.referredToRole,
      status: r.status,
      anecdotalId: r.anecdotalRecordId,
    });
  }

  // ---- Counseling sessions (guidance/nurse referrals get 1-3) ----
  {
    const guidanceId = core.staff["guidance"] ?? acad.advisers[0]?.id ?? core.principalId;
    const batcherC = new Batcher("Counseling", 1000, (ch) => prisma.counselingSession.createMany({ data: ch }) as any);
    for (const r of referrals) {
      if (r.role !== "guidance_counselor" && r.role !== "nurse") continue;
      if (rng.next() < 0.2) continue;
      const n = rng.weighted([1, 2, 3], [0.55, 0.3, 0.15]);
      const term = r.termId === core.t1Id ? t1 : t2;
      for (let k = 0; k < n; k++) {
        const st = r.status === "resolved" && k === 0 ? "completed" : rng.weighted(["scheduled", "completed", "cancelled"], [0.35, 0.5, 0.15]);
        await batcherC.push({
          referralId: r.id,
          sessionType: rng.pick(["individual", "parent_conference", "group", "home_visit"] as const),
          scheduledAt: inTermDate(rng, term.start, term.end, r.termId === core.t2Id ? T2_CUTOFF : undefined),
          venue: rng.pick(["Guidance Office", "Clinic", "Conference Room", "Classroom"] as const),
          status: st,
          sessionNotes: st === "completed" ? "Session completed with action items and parent concurrence." : null,
          outcome: st === "completed" ? rng.pick(["Improved", "Stable; continue monitoring", "Referred for further support"]) : null,
          createdBy: guidanceId,
          completedAt: st === "completed" ? inTermDate(rng, term.start, term.end) : null,
        });
      }
    }
    await batcherC.finish();
  }

  // ---- Clinic attachments for completed sessions ----
  {
    const sessions = await prisma.counselingSession.findMany({ where: { status: "completed" }, select: { id: true } });
    const nurseId = core.staff["nurse"] ?? core.principalId;
    const rows: any[] = [];
    for (const s of sessions) {
      if (rng.next() < 0.4) continue;
      const n = rng.next() < 0.8 ? 1 : 2;
      for (let k = 0; k < n; k++) {
        rows.push({
          sessionId: s.id,
          fileUrl: `https://example.com/clinic/${s.id.slice(-8)}_${k}.jpg`,
          fileName: `clinic-doc-${k + 1}.jpg`,
          mimeType: "image/jpeg",
          fileSize: rng.int(20000, 120000),
          uploadedBy: nurseId,
        });
      }
    }
    await bulkCreate("ClinicAttachments", rows.length, (ch) => prisma.clinicSessionAttachment.createMany({ data: ch }) as any, rows, 1000);
  }

  console.log(`Behavioral: anecdotal=${anecdotalAll.length} referrals=${referrals.length}`);
  void sectionOfRoster;
  return { anecdotalAll, referrals, anecdotalCount };
}
