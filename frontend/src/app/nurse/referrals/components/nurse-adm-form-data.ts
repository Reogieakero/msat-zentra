"use client";

import { fetchOcForm01Detail } from "@/components/ocform01/ocform01";
import {
  CONCERN_OPTIONS,
  type GcForm03Data,
} from "@/services/guidance/gcform03.types";
import { buildGcForm03Data } from "@/services/guidance/gcform03.service";
import type { GuidanceAdmCase } from "@/services/guidance/adm.types";
import { parseSavedNurseAdmForm } from "@/services/nurse/referrals.service";
import type { NurseQueueRow } from "@/services/nurse/nurse.types";

function savedConcernsRecord(labels: string[]): GcForm03Data["concerns"] {
  const record: GcForm03Data["concerns"] = {
    absences: false,
    academic: false,
    personal: false,
    family: false,
    peer: false,
    others: false,
    othersText: "",
  };
  const extras: string[] = [];
  for (const label of labels) {
    if (label.startsWith("Others:")) {
      record.others = true;
      const text = label.slice("Others:".length).trim();
      if (text) extras.push(text);
      continue;
    }
    const opt = CONCERN_OPTIONS.find((c) => c.label === label);
    if (opt && opt.key !== "others") {
      record[opt.key] = true;
    } else if (opt) {
      record.others = true;
    } else {
      record.others = true;
      extras.push(label);
    }
  }
  if (extras.length > 0) record.othersText = extras.join(", ");
  return record;
}

/**
 * Builds the GCForm-03 data for a clinic ADM case — the same shape the
 * guidance ADM desk previews, with the nurse's saved referral-form answers
 * layered over the anecdotal report. Shared by the card's folder preview and
 * the "view referral form" overlay so both render the identical sheet.
 */
export async function buildNurseGcForm03Data(
  row: NurseQueueRow,
): Promise<GcForm03Data> {
  const saved = parseSavedNurseAdmForm(row.notes);
  let report = null;
  if (row.anecdotalId) {
    try {
      report = await fetchOcForm01Detail(row.anecdotalId);
    } catch {
      report = null;
    }
  }
  const adapter: GuidanceAdmCase = {
    id: row.id,
    student: row.student,
    lrn: row.lrn,
    section: row.section,
    grade: row.grade,
    stage: "consultation",
    stageLabel: "Consultation and referral",
    eligibility: "pending",
    referralId: row.id,
    referralStatus: row.status,
    reason: row.reason,
    referredBy: "",
    preparedBy: "",
    date: row.date,
    meetingAttended: null,
    hasHomeVisit: false,
    approved: false,
    approvedAt: null,
    anecdotalId: row.anecdotalId ?? undefined,
    category: row.category,
    anecdotalExcerpt: row.anecdotal?.incident ?? "",
    recommendations: row.anecdotal?.notes ?? "",
  };
  const base = buildGcForm03Data(
    adapter,
    report,
    saved?.recommendation ?? "",
    "",
  );
  if (!saved) return base;
  return {
    ...base,
    concerns: savedConcernsRecord(saved.concerns),
    detailsOfConcern: saved.details || base.detailsOfConcern,
    referrerActions: saved.actions
      ? [
          { date: row.date, action: saved.actions },
          { date: "", action: "" },
          { date: "", action: "" },
        ]
      : base.referrerActions,
    guidanceRecommendations: saved.recommendation || base.guidanceRecommendations,
    followUp: saved.followUp || base.followUp,
  };
}
