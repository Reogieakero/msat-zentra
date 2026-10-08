"use client";

import { useState } from "react";
import { Award, BookOpen, Check, Eye, FileText, Home, Landmark, Send, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReferralStepDialog } from "./ReferralStepDialog";
import { ReferralCanvasCaseFile } from "./referral-canvas-case-file";
import { ReferralCanvasFlow } from "./referral-canvas-flow";
import type { ReferralCanvasProps, ReferralData, Stage, StageState } from "./referral-canvas-types";
import styles from "./ReferralCanvas.module.css";

const TARGET_ROLE_LABELS: Record<string, string> = {
  nurse: "Nurse",
  guidance_counselor: "Guidance Counselor",
  adm_coordinator: "ADM Coordinator",
  principal: "Principal",
};

const REVIEWER_LABELS: Record<string, string> = {
  nurse: "School Nurse",
  guidance_counselor: "Guidance Counselor",
  lrpc: "LRPC",
  adm_coordinator: "ADM Coordinator",
};

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function humanize(value?: string | null): string {
  const words = (value ?? "").replace(/[_-]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

const STATUS_BADGE_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  resolved: "Resolved",
  dismissed: "Cancelled",
  escalated: "Escalated",
  info_requested: "Info Requested",
  follow_up: "Follow Up",
};

const ADM_ORDER = [
  "anecdotal",
  "consultation",
  "meeting_parents",
  "home_visitation",
  "certification",
  "principal_approval",
  "enrollment_monitoring",
  "completion",
];

const ADM_PIPELINE_META: {
  stage: string;
  order: number;
  label: string;
  owner: string;
  principalAction: boolean;
  description: string;
}[] = [
  {
    stage: "anecdotal",
    order: 1,
    label: "Anecdotal Report Filed",
    owner: "Adviser",
    principalAction: false,
    description: "Adviser files the anecdotal report documenting the learner's concern.",
  },
  {
    stage: "consultation",
    order: 2,
    label: "Consultation & Referral",
    owner: "Guidance / Nurse / LRPC",
    principalAction: false,
    description: "Routed to Guidance Counselor, School Nurse, or LRPC for review.",
  },
  {
    stage: "meeting_parents",
    order: 3,
    label: "Meeting with Parents/Guardians",
    owner: "ADM Coordinator & Teachers",
    principalAction: false,
    description: "Meeting with parents/guardians. Attended → minutes logged; otherwise → home visitation.",
  },
  {
    stage: "home_visitation",
    order: 4,
    label: "Home Visitation (if no meeting)",
    owner: "Guidance Counselor",
    principalAction: false,
    description: "Conducted only when parents did not attend the meeting. Both branches converge at certification.",
  },
  {
    stage: "certification",
    order: 5,
    label: "Recommendation & Certification",
    owner: "ADM Coordinator",
    principalAction: false,
    description: "ADM Coordinator records the recommendation and issues the ADM certification.",
  },
  {
    stage: "principal_approval",
    order: 6,
    label: "School Head (Principal) Approval",
    owner: "Principal",
    principalAction: true,
    description: "Principal signs the certification and authorizes module release and monitoring.",
  },
  {
    stage: "enrollment_monitoring",
    order: 7,
    label: "Modules Completed & Returned",
    owner: "Student",
    principalAction: false,
    description: "Student completes the modules; Coordinator / Teacher track progress.",
  },
  {
    stage: "completion",
    order: 8,
    label: "Case Closed",
    owner: "ADM Coordinator",
    principalAction: false,
    description: "Learner has returned and the ADM case is closed.",
  },
];

const ELIGIBILITY_LABELS: Record<string, string> = {
  pending: "For review",
  eligible: "Eligible",
  ineligible: "Ineligible",
};

function buildStages(referral: ReferralData): Stage[] {
  const status = referral.status ?? "pending";
  const cancelled = status === "dismissed";
  const targetRole = referral.targetRole ?? referral.referredToRole ?? "";
  const targetLabel = TARGET_ROLE_LABELS[targetRole] ?? (targetRole ? humanize(targetRole) : "Receiving role");
  const resolved = status === "resolved";

  if (referral.track === "adm") {
    const stageKey = referral.admStage ?? "consultation";
    const currentIdx = Math.max(0, ADM_ORDER.indexOf(stageKey));

    const reviewerKey = referral.admReceiver ?? targetRole;
    const reviewerLabel = REVIEWER_LABELS[reviewerKey ?? ""] ?? targetLabel;
    const meetingDone = !!referral.hasParentMeeting;
    const homeDone = !!referral.hasHomeVisit;
    const certified = currentIdx >= ADM_ORDER.indexOf("certification");
    const approved = !!referral.admApproved;
    const completed = resolved || stageKey === "completion";

    const stateAt = (idx: number): StageState => {

      if (cancelled) return idx === 0 ? "done" : "todo";
      if (completed) return "done";
      if (idx < currentIdx) return "done";
      if (idx === currentIdx) return "current";
      return "todo";
    };

    const homeSkipped =
      !homeDone && !!referral.meetingAttended && currentIdx > ADM_ORDER.indexOf("home_visitation");

    const statusText: Record<string, string> = {
      anecdotal: `Observed ${referral.observationDate ?? "—"}`,
      consultation: `${reviewerLabel} · ${formatDate(referral.referredAt)}`,
      meeting_parents: meetingDone
        ? referral.meetingAttended
          ? "Attended"
          : "Scheduled"
        : "If needed",
      home_visitation: homeDone ? "Done" : homeSkipped ? "Skipped" : "If no meeting",
      certification: certified
        ? (ELIGIBILITY_LABELS[referral.admEligibility ?? ""] ?? (referral.admEligibility ? humanize(referral.admEligibility) : "Issued"))
        : "Pending issuance",
      principal_approval: approved
        ? `Signed · ${formatDate(referral.admApprovedAt)}`
        : "Pending signature",
      enrollment_monitoring:
        currentIdx > ADM_ORDER.indexOf("enrollment_monitoring") || completed
          ? "Tracking submissions"
          : "Pending",
      completion: completed
        ? formatDate(referral.resolvedAt ?? referral.admApprovedAt)
        : "Pending",
    };

    const ICONS: Record<string, typeof Send> = {
      anecdotal: FileText,
      consultation: Send,
      meeting_parents: Users,
      home_visitation: Home,
      certification: Award,
      principal_approval: Landmark,
      enrollment_monitoring: BookOpen,
      completion: Check,
    };

    return ADM_PIPELINE_META.map((meta, idx) => {
      const key = meta.stage;
      let state = stateAt(idx);
      if (key === "home_visitation" && (homeDone || completed)) state = "done";
      else if (key === "home_visitation" && homeSkipped) state = "todo";
      if (key === "principal_approval" && (approved || completed)) state = "done";
      const status = statusText[key] ?? "";
      return {
        key,
        label: meta.label,

        sub: `${key === "consultation" ? reviewerLabel : meta.owner} · ${status}`,
        state,
        optional: key === "home_visitation",
        owner: key === "consultation" ? reviewerLabel : meta.owner,
        description:
          key === "consultation"
            ? `Routed to ${reviewerLabel} for review — only this role acts at consultation.`
            : meta.description,
        principalAction: meta.principalAction,
        Icon: ICONS[key] ?? Send,
      };
    });
  }

  const reviewDone = status === "in_progress" || resolved;
  const meetingDone = !!referral.hasParentMeeting;
  const homeDone = !!referral.hasHomeVisit;

  const reviewState: StageState = cancelled ? "todo" : resolved || reviewDone ? "done" : "current";
  const meetingState: StageState = cancelled ? "todo" : meetingDone || resolved ? "done" : reviewDone ? "current" : "todo";
  const homeState: StageState = cancelled ? "todo" : homeDone || resolved ? "done" : meetingDone || reviewDone ? "current" : "todo";
  const resolvedState: StageState = cancelled ? "todo" : resolved ? "done" : status === "in_progress" ? "current" : "todo";

  return [
    {
      key: "referred",
      label: "Referred",
      sub: `${targetLabel} · ${formatDate(referral.referredAt)}`,
      state: "done",
      Icon: Send,
    },
    {
      key: "review",
      label: "Review",
      sub: cancelled ? "Cancelled" : reviewDone ? (resolved ? "Reviewed" : "Under review") : `Waiting on ${targetLabel}`,
      state: reviewState,
      Icon: Eye,
    },
    {
      key: "meeting",
      label: "Parent meeting",
      sub:
        meetingDone
          ? referral.meetingAttended
            ? "Attended"
            : "Scheduled"
          : "If needed",
      state: meetingState,
      optional: true,
      Icon: Users,
    },
    {
      key: "home",
      label: "Home visit",
      sub: homeDone ? "Done" : "If needed",
      state: homeState,
      optional: true,
      Icon: Home,
    },
    {
      key: "resolved",
      label: "Resolved",
      sub: cancelled ? "Cancelled" : resolved ? formatDate(referral.resolvedAt) : status === "in_progress" ? "In Progress" : "Pending",
      state: resolvedState,
      Icon: Check,
    },
  ];
}

export function ReferralCanvas({ referral, onCancelRequest, onDeleteRequest }: ReferralCanvasProps) {

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!referral) {
    return (
      <div className={`${styles.canvas} ${styles.canvasEmpty}`}>
        <p className={styles.emptyTitle}>No case on the canvas</p>
        <p className={styles.emptyBody}>
          Select a referral from the library to view its workflow.
        </p>
      </div>
    );
  }

  const stages = buildStages(referral);

  const activeStage = activeIndex !== null ? (stages[activeIndex] ?? null) : null;

  return (
    <div className={styles.canvas} aria-label={`Workflow for ${referral.studentName}`}>
      <div className={styles.canvasHead}>
        <div className={styles.canvasId}>
          <h2 className={styles.canvasTitle}>{referral.studentName ?? "No case selected"}</h2>
          <p className={styles.canvasSub}>
            {referral.section ?? ""} · LRN {referral.lrn ?? ""}
          </p>
        </div>
        <div className={styles.canvasBadges}>
          {referral.track === "adm" && <Badge variant="default">ADM case</Badge>}
          <Badge variant={referral.status === "resolved" ? "success" : referral.status === "in_progress" ? "warning" : "secondary"}>
            {STATUS_BADGE_LABELS[referral.status ?? ""] ?? humanize(referral.status)}
          </Badge>
          {referral.status !== "dismissed" && referral.status !== "resolved" && onCancelRequest ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className={styles.btnRed}
              onClick={() =>
                onCancelRequest({ id: referral.id ?? "", studentName: referral.studentName ?? "" })
              }
            >
              Cancel referral
            </Button>
          ) : null}
          {referral.status === "dismissed" && onDeleteRequest ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className={styles.btnRed}
              onClick={() =>
                onDeleteRequest({ id: referral.id ?? "", studentName: referral.studentName ?? "" })
              }
            >
              <Trash2 aria-hidden />
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      <ReferralCanvasFlow stages={stages} onSelect={setActiveIndex} />

      <ReferralCanvasCaseFile referral={referral} />

      <ReferralStepDialog
        step={
          activeStage
            ? { ...activeStage, index: activeIndex ?? 0, total: stages.length }
            : null
        }
        timeline={referral.timeline ?? []}
        onClose={() => setActiveIndex(null)}
      />
    </div>
  );
}
