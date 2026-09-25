"use client";

import { Fragment, useState } from "react";
import { Award, BookOpen, Check, Eye, FileText, Home, Landmark, Send, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReadMore } from "./ReadMore";
import { ReferralStepDialog } from "./ReferralStepDialog";
import styles from "./ReferralCanvas.module.css";

interface ReferralData {
  id?: string;
  studentName?: string;
  section?: string;
  lrn?: string;
  track?: string;
  status?: "pending" | "in_progress" | "resolved" | "dismissed" | "escalated" | "info_requested" | "follow_up";
  reason?: string;
  notes?: string | null;
  observationDate?: string;
  category?: string;
  referredToRole?: string;
  targetRole?: string;
  referredAt?: string;
  resolvedAt?: string | null;
  // Teacher-picked ADM consultation reviewer (nurse | guidance_counselor |
  // lrpc) — only this role acts at consultation. Null on legacy rows.
  admReceiver?: string | null;
  hasParentMeeting?: boolean;
  meetingAttended?: boolean | null;
  hasHomeVisit?: boolean;
  admStage?: string | null;
  admStageLabel?: string | null;
  admEligibility?: string | null;
  admApproved?: boolean;
  admApprovedAt?: string | null;
  timeline?: { label: string; date: string }[];
}

interface ReferralCanvasProps {
  referral: ReferralData | null;
  onCancelRequest?: (referral: { id: string; studentName: string }) => void;
  onDeleteRequest?: (referral: { id: string; studentName: string }) => void;
}

type StageState = "done" | "current" | "todo";

interface Stage {
  key: string;
  label: string;
  sub: string;
  state: StageState;
  optional?: boolean;
  owner?: string;
  description?: string;
  principalAction?: boolean;
  Icon: typeof Send;
}

const TARGET_ROLE_LABELS: Record<string, string> = {
  nurse: "Nurse",
  guidance_counselor: "Guidance Counselor",
  adm_coordinator: "ADM Coordinator",
  principal: "Principal",
};

/* Consultation-reviewer labels — the teacher-picked receiver for ADM cases.
   Only the selected role acts at consultation; the rest see it read-only. */
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

// Friendly fallback for unmapped codes: no underscores, Title Case
// (e.g. "guidance_counselor" -> "Guidance Counselor") — plain words for
// non-technical readers.
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

// Pipeline derivation (teacher tracking, status-only — mirrors the backend
// ADM state machine in backend/src/services/adm.ts):
// - General track: Referred → Review → Parent meeting → Home visit → Resolved.
// - ADM track: the full 8-stage flow — Anecdotal → Consultation → Parent
//   meeting → Home visit → Certification → Principal approval → Monitoring →
//   Completion. A newly submitted referral lands immediately as
//   Referred/Consultation=current so the teacher can track it from submit.
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

// Official 8-stage ADM pipeline — same stages as the backend state machine
// (backend/src/services/adm.ts) and the principal ADM board
// (principal/adm/adm.ts). Teacher tracking is status-only: labels, owners,
// and generic process descriptions only — never clinical detail.
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

const ADM_META_BY_STAGE = new Map(ADM_PIPELINE_META.map((s) => [s.stage, s]));

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
    // Truthful routing: the picked consultation reviewer owns this step —
    // not every reviewer. Falls back to the target role on legacy rows.
    const reviewerKey = referral.admReceiver ?? targetRole;
    const reviewerLabel = REVIEWER_LABELS[reviewerKey ?? ""] ?? targetLabel;
    const meetingDone = !!referral.hasParentMeeting;
    const homeDone = !!referral.hasHomeVisit;
    const certified = currentIdx >= ADM_ORDER.indexOf("certification");
    const approved = !!referral.admApproved;
    const completed = resolved || stageKey === "completion";

    const stateAt = (idx: number): StageState => {
      // A cancelled case never advances: only the filed step stays done so
      // no stage is ever marked Current afterwards.
      if (cancelled) return idx === 0 ? "done" : "todo";
      if (completed) return "done";
      if (idx < currentIdx) return "done";
      if (idx === currentIdx) return "current";
      return "todo";
    };

    // Home visit is a conditional branch: when parents attended and the case
    // moved past it without a visit, show Skipped instead of Done.
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
        // Owner + status on the card; generic process description on hover.
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

  // A cancelled case never advances: everything past Referred stays To Do.
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

// Workflow canvas: the selected referral rendered as connected stage nodes on
// a dotted canvas. Read-only — downstream detail stays with the receiving role.
export function ReferralCanvas({ referral, onCancelRequest, onDeleteRequest }: ReferralCanvasProps) {
  // Step detail overlay: every box opens info for that step (status,
  // owner, activity time/date and actions executed).
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

  // Compact rows that fit the canvas: one row up to 5 steps, otherwise
  // chunks of 4 — boxes joined by arrow connectors, no scrolling.
  const perRow = stages.length <= 5 ? stages.length : 4;
  const rows: { stage: Stage; index: number }[][] = [];
  stages.forEach((stage, index) => {
    const r = Math.floor(index / perRow);
    (rows[r] ??= []).push({ stage, index });
  });

  const activeStage = activeIndex !== null ? (stages[activeIndex] ?? null) : null;

  function edgeLit(i: number): boolean {
    const s = stages[i].state;
    return s === "done" || (s === "current" && (i === 0 || stages[i - 1].state === "done"));
  }

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

      <div className={styles.flow}>
        {rows.map((row, r) => (
          <ol
            key={r}
            className={styles.row}
            style={{
              gridTemplateColumns: `repeat(${row.length - 1}, minmax(0, 1fr) auto) minmax(0, 1fr)`,
            }}
            aria-label={rows.length > 1 ? `Referral progress, row ${r + 1}` : "Referral progress"}
          >
            {row.map(({ stage, index: i }) => {
              const Icon = stage.Icon;
              const lit = edgeLit(i);
              const stateText =
                stage.state === "done" ? "Done" : stage.state === "current" ? "Current" : "Queued";
              const stateClass =
                stage.state === "done"
                  ? styles.stateDone
                  : stage.state === "current"
                    ? styles.stateCurrent
                    : styles.stateTodo;
              return (
                <Fragment key={stage.key}>
                  {i % perRow !== 0 && (
                    <li className={styles.edge} aria-hidden>
                      <span className={`${styles.wire} ${lit ? styles.wireLit : ""}`} />
                      <span className={`${styles.head} ${lit ? styles.headLit : ""}`} />
                    </li>
                  )}
                  <li className={styles.nodeItem}>
                    <button
                      type="button"
                      className={`${styles.node} ${stage.state === "done" ? styles.nodeDone : ""} ${stage.state === "current" ? styles.nodeCurrent : ""} ${stage.state === "todo" ? styles.nodeTodo : ""}`}
                      title={`${stage.label} — view step details`}
                      onClick={() => setActiveIndex(i)}
                      aria-haspopup="dialog"
                    >
                      <span
                        className={`${styles.tile} ${stage.state === "done" ? styles.tileDone : ""} ${stage.state === "current" ? styles.tileCurrent : ""}`}
                        aria-hidden
                      >
                        <Icon />
                      </span>
                      <span className={styles.nodeText}>
                        <span className={styles.nodeStep}>
                          Step {i + 1} of {stages.length}
                        </span>
                        <span className={styles.nodeLabel}>
                          {stage.label}
                          {stage.optional ? <span className={styles.opt}> (optional)</span> : null}
                        </span>
                        <span className={styles.nodeSub}>{stage.sub}</span>
                        {stage.principalAction ? (
                          <span className={styles.nodeSub}>Principal action</span>
                        ) : null}
                      </span>
                      <span className={`${styles.stateTag} ${stateClass}`}>{stateText}</span>
                    </button>
                  </li>
                </Fragment>
              );
            })}
          </ol>
        ))}
      </div>

      <div className={styles.caseFile}>
        <div className={`${styles.caseRow} ${styles.caseSpanReason}`}>
          <span className={styles.caseLabel}>
            <FileText className={styles.caseIcon} aria-hidden />
            Reason
          </span>
          <ReadMore text={referral.reason ?? "—"} maxLines={3} className={styles.caseText} />
        </div>
        <div className={`${styles.caseRow} ${styles.caseSpanSource}`}>
          <span className={styles.caseLabel}>
            <Eye className={styles.caseIcon} aria-hidden />
            Source anecdotal
          </span>
          <p className={styles.caseText}>
            <span className={styles.caseDate}>Observed {referral.observationDate ?? "—"}</span>
          </p>
        </div>
        {referral.status === "dismissed" && referral.notes ? (
          <div className={`${styles.caseRow} ${styles.caseSpanFull}`}>
            <span className={styles.caseLabel}>
              <Trash2 className={styles.caseIcon} aria-hidden />
              Cancellation reason
            </span>
            <ReadMore text={referral.notes} maxLines={3} className={styles.caseText} />
          </div>
        ) : null}
      </div>

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