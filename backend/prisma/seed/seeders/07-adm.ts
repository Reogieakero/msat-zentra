import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { T2_CUTOFF, DRY } from "../config.js";
import type { CoreCtx } from "./00-core.js";
import type { AcademicCtx } from "./01-academic.js";
import type { RosterCtx } from "./02-roster.js";
import type { BehavioralCtx } from "./05-behavioral.js";
import type { Rng } from "../utils/rng.js";
import { keyId } from "../utils/rng.js";
import { inTermDate } from "../utils/calendar.js";
import { bulkCreate } from "../utils/chunk.js";

const STAGES = ["anecdotal", "consultation", "meeting_parents", "home_visitation", "certification", "principal_approval", "enrollment_monitoring", "completion"] as const;
const STAGE_W = [0.1, 0.15, 0.2, 0.1, 0.15, 0.15, 0.1, 0.05];

export async function seedAdm(
  prisma: PrismaClient,
  core: CoreCtx,
  acad: AcademicCtx,
  roster: RosterCtx,
  behav: BehavioralCtx,
  rng: Rng,
) {
  if (DRY) return { profiles: [] as { id: string }[] };
  const t1 = core.termIds.find((t) => t.n === 1)!;
  const t2 = core.termIds.find((t) => t.n === 2)!;
  const admId = core.staff["adm"] ?? core.principalId;
  const principalId = core.principalId;

  // ADM candidates: 2.5% of profiles with (or newly given) adm_coordinator referral.
  const admReferrals = behav.referrals.filter((r) => r.role === "adm_coordinator" && r.studentId);
  const byStudent = new Map(admReferrals.map((r) => [r.studentId as string, r]));
  const candidates = rng.shuffle(roster.profiles).slice(0, Math.floor(roster.profiles.length * 0.035));

  // Ensure each candidate has an adm referral (create missing via their anecdotal or fresh).
  const anecByStudent = new Map<string, string>();
  for (const a of behav.anecdotalAll) if (a.studentId) anecByStudent.set(a.studentId, a.id);
  for (const p of candidates) {
    if (byStudent.has(p.userId)) continue;
    const anecId = anecByStudent.get(p.userId);
    if (!anecId) continue;
    const sec = acad.sectionById.get(p.sectionId);
    const row: any = {
      anecdotalRecordId: anecId,
      referredToRole: "adm_coordinator" as const,
      referredBy: sec?.adviserId ?? admId,
      reason: "ADM eligibility assessment.",
      consultReviewer: rng.pick(["nurse", "guidance_counselor", "lrpc"] as const),
      status: "in_progress" as const,
      studentId: p.userId,
      termId: rng.next() < 0.6 ? core.t1Id : core.t2Id,
    };
    const created = await prisma.referral.create({ data: row, select: { id: true } }).catch(() => null);
    if (created) byStudent.set(p.userId, { id: created.id, studentKey: `S:${p.userId}`, studentId: p.userId, rosterId: null, termId: row.termId, role: "adm_coordinator", status: "in_progress", anecdotalId: anecId });
  }

  const final = candidates.filter((p) => byStudent.has(p.userId)).slice(0, Math.floor(roster.profiles.length * 0.028));
  console.log(`ADM cases: ${final.length}`);

  let devSerial = 10000;
  for (const p of final) {
    const ref = byStudent.get(p.userId)!;
    const term = ref.termId === core.t1Id ? t1 : t2;
    const stage = rng.weighted([...STAGES], [...STAGE_W]);
    const eligibility = ["certification", "principal_approval", "enrollment_monitoring", "completion"].includes(stage)
      ? rng.weighted(["eligible", "eligible", "pending", "ineligible"], [0.7, 0.1, 0.1, 0.1] as any) as any
      : rng.weighted(["pending", "eligible", "ineligible"], [0.6, 0.3, 0.1]);
    const needsApproval = ["principal_approval", "enrollment_monitoring", "completion"].includes(stage);
    const pid = keyId("adm", `${p.userId.slice(-8)}_${ref.termId.slice(-4)}`);
    const attended = !["anecdotal", "consultation"].includes(stage) ? rng.next() < 0.85 : rng.next() < 0.3;

    await prisma.admLearnerProfile.upsert({
      where: { id: pid },
      update: {},
      create: {
        id: pid,
        studentId: p.userId,
        referralId: ref.id,
        eligibilityStatus: eligibility,
        stage: stage as any,
        preparedBy: admId,
        approvedBy: needsApproval ? principalId : null,
        approvedAt: needsApproval ? inTermDate(rng, term.start, term.end, ref.termId === core.t2Id ? T2_CUTOFF : undefined) : null,
        certificationDetails: { needs: "Modules + device", plan: "Individualized ADM plan", stage },
        termId: ref.termId,
        confidentialityLevel: "restricted" as const,
        parentMeetings: {
          create: [
            {
              recordedBy: admId,
              meetingDatetime: inTermDate(rng, term.start, term.end, ref.termId === core.t2Id ? T2_CUTOFF : undefined),
              venue: rng.next() < 0.75 ? "school" : "home",
              attended,
              parentConfirmedAt: attended ? inTermDate(rng, term.start, term.end) : null,
              minutesOfMeeting: "Discussed ADM plan, module schedule, and device care.",
              attendees: [{ name: "Parent/Guardian", role: "parent/guardian" }, { name: "Adviser", role: "teacher" }] as any,
            },
          ],
        },
        modules: {
          create: [1, 2, 3].map((m) => ({
            moduleName: `ADM Module ${m}: ${["Literacy", "Numeracy", "Values"][m - 1]}`,
            releaseDate: inTermDate(rng, term.start, term.end),
            dueDate: inTermDate(rng, term.start, term.end),
            submitted: rng.next() < (stage === "completion" ? 0.95 : 0.6),
            recordedBy: admId,
          })),
        },
        ...( ["enrollment_monitoring", "completion", "certification", "principal_approval"].includes(stage)
          ? {
              devices: {
                create: [
                  {
                    deviceType: "Tablet",
                    deviceSerial: `ADM-TAB-${devSerial++}`,
                    issuedBy: admId,
                    issuedDate: inTermDate(rng, term.start, term.end),
                    returnedDate: stage === "completion" ? inTermDate(rng, term.start, term.end) : null,
                    conditionNotes: stage === "completion" ? "Returned in good condition." : "Issued; reminded on care.",
                  },
                ],
              },
            }
          : {}),
        forms: {
          create: [
            { formType: "REFERRAL_FORM" as const, title: "Referral Form", status: (attended || eligibility === "eligible" ? "verified" : "submitted") as const, uploadedBy: admId, notes: "ADM intake form." },
            { formType: "ANECDOTAL_REPORT" as const, title: "Anecdotal Report", status: (eligibility === "eligible" ? "verified" : "submitted") as const, uploadedBy: admId },
            ...(attended ? [{ formType: "MINUTES_OF_MEETING" as const, title: "Minutes of Meeting", status: "submitted" as const, uploadedBy: admId }] : []),
            ...(needsApproval ? [{ formType: "CERTIFICATION" as const, title: "Certification", status: "verified" as const, uploadedBy: admId }] : [{ formType: "CERTIFICATION" as const, title: "Certification", status: "pending" as const, uploadedBy: admId }]),
          ],
        },
      },
    });
  }

  // Extra meetings/invitees/attachments/modules/devices/forms to reach volume.
  const admProfiles = await prisma.admLearnerProfile.findMany({ select: { id: true } });
  const invitePool = [core.staff["guidance"], core.staff["nurse"], admId, ...acad.advisers.slice(0, 5).map((a) => a.id)].filter(Boolean) as string[];
  {
    const meetings = await prisma.admParentMeeting.findMany({ select: { id: true } });
    const invRows: any[] = [];
    for (const m of meetings) {
      const n = rng.int(1, 3);
      for (let k = 0; k < n; k++) {
        invRows.push({ meetingId: m.id, userId: rng.pick(invitePool) });
      }
    }
    // Dedupe pairs in-memory.
    const seen = new Set<string>();
    const ded = invRows.filter((r) => {
      const k = `${r.meetingId}|${r.userId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    await bulkCreate("AdmInvitees", ded.length, (ch) => prisma.admMeetingInvitee.createMany({ data: ch, skipDuplicates: true }) as any, ded, 1000);

    const attRows: any[] = [];
    for (const m of meetings) {
      if (rng.next() < 0.5) continue;
      attRows.push({
        meetingId: m.id,
        fileUrl: `https://example.com/adm/meeting-${m.id.slice(-8)}.jpg`,
        fileName: `meeting-evidence.jpg`,
        mimeType: "image/jpeg",
        fileSize: rng.int(30000, 150000),
        uploadedBy: admId,
      });
    }
    await bulkCreate("AdmMeetingAtt", attRows.length, (ch) => prisma.admMeetingAttachment.createMany({ data: ch }) as any, attRows, 1000);
  }

  return { profiles: admProfiles };
}
