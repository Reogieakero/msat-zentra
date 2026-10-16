import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { DRY } from "../config.js";
import type { CoreCtx } from "./00-core.js";
import type { RosterCtx } from "./02-roster.js";
import type { BehavioralCtx } from "./05-behavioral.js";
import type { Rng } from "../utils/rng.js";
import { inTermDate } from "../utils/calendar.js";
import { bulkCreate } from "../utils/chunk.js";

const COMPLAINTS = [
  "Mild fever and headache", "Stomach ache after lunch", "Minor abrasion on knee from P.E.",
  "Cough and sore throat", "Dizziness during flag ceremony", "Sprained ankle during sports",
  "Eye irritation", "Toothache", "Headache after class", "Skin rash",
];
const DIAGNOSES = [
  "Viral fever, advised rest and hydration", "Acute gastritis, advised dietary monitoring",
  "Superficial abrasion, cleaned and dressed", "Pharyngitis, advised rest",
  "Mild dehydration, advised fluid intake", "Sprain grade 1, RICE advised",
  "Conjunctivitis, referred for checkup", "Dental caries, referred to dentist",
];

export async function seedHealthHome(
  prisma: PrismaClient,
  core: CoreCtx,
  roster: RosterCtx,
  behav: BehavioralCtx,
  rng: Rng,
) {
  if (DRY) return;
  const t1 = core.termIds.find((t) => t.n === 1)!;
  const t2 = core.termIds.find((t) => t.n === 2)!;
  const nurseId = core.staff["nurse"] ?? core.principalId;
  const guidanceId = core.staff["guidance"] ?? core.principalId;

  const profiles = rng.shuffle(roster.profiles);
  const nurseRefs = behav.referrals.filter((r) => r.role === "nurse" && r.studentId);
  const nurseRefByStudent = new Map(nurseRefs.map((r) => [r.studentId as string, r.id]));

  // Health: ~22% of profiles.
  {
    const targets = profiles.slice(0, Math.floor(profiles.length * 0.22));
    const rows: any[] = [];
    for (const p of targets) {
      const n = rng.weighted([1, 2], [0.8, 0.2]);
      for (let k = 0; k < n; k++) {
        const termId = rng.next() < 0.6 ? core.t1Id : core.t2Id;
        const term = termId === core.t1Id ? t1 : t2;
        rows.push({
          studentId: p.userId,
          referralId: rng.next() < 0.3 ? (nurseRefByStudent.get(p.userId) ?? null) : null,
          visitDatetime: inTermDate(rng, term.start, term.end),
          complaint: rng.pick(COMPLAINTS),
          diagnosis: rng.pick(DIAGNOSES),
          treatmentGiven: rng.pick(["Administered first aid and advised rest.", "Given paracetamol per protocol; parent notified.", "Wound cleaned and dressed; return if worsens."]),
          recordedBy: nurseId,
          termId,
          confidentialityLevel: rng.next() < 0.85 ? ("restricted" as const) : ("confidential" as const),
        });
      }
    }
    await bulkCreate("HealthRecords", rows.length, (ch) => prisma.healthRecord.createMany({ data: ch }) as any, rows, 1000);
  }

  // Home visitation: ~10% of profiles.
  {
    const targets = profiles.slice(Math.floor(profiles.length * 0.2), Math.floor(profiles.length * 0.3));
    const rows: any[] = [];
    for (const p of targets) {
      const termId = rng.next() < 0.6 ? core.t1Id : core.t2Id;
      const term = termId === core.t1Id ? t1 : t2;
      void term;
      rows.push({
        studentId: p.userId,
        personVisited: rng.pick(["Mother", "Father", "Guardian"] as const),
        homeCondition: rng.pick(["Adequate; needs dedicated study area.", "Crowded but orderly; study corner recommended.", "Adequate lighting and ventilation."]),
        familyCondition: rng.pick(["Supportive.", "Supportive; both parents working.", "Extended family present; cooperative."]),
        agreements: "Family agrees to support attendance and study schedule.",
        certificationBy: guidanceId,
        termId,
        confidentialityLevel: "restricted" as const,
      });
    }
    await bulkCreate("HomeVisits", rows.length, (ch) => prisma.homeVisitationRecord.createMany({ data: ch }) as any, rows, 1000);
  }
}
