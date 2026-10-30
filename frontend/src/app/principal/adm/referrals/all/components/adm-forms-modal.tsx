"use client";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Pill } from "@/components/ui/pill";
import {
  ANECDOTAL_CATEGORY_COLORS,
  ANECDOTAL_CATEGORY_TONES,
  AnecdotalRecordKanbanCard,
} from "@/components/anecdotal/anecdotal-record-kanban-card";
import { formStatusLabel, formStatusTone } from "@/lib/labels/status-tone";
import type {
  AdmReferralForm,
  AdmReferralRow,
} from "@/services/principal/adm.types";
import styles from "../all.module.css";

const FORM_TYPE_LABELS: Record<string, string> = {
  REFERRAL_FORM: "Referral",
  ANECDOTAL_REPORT: "Anecdotal",
  CERTIFICATION: "Certification",
  MINUTES_OF_MEETING: "Minutes",
  HV_FORM: "Home Visit",
  PRINCIPAL_SIGNAGE: "Principal signage",
};

/** Every linked form gets the amber ADM folder, except the anecdotal report —
 *  that one keeps its record's own category colour. */
const FORM_FOLDER_COLOR = "#f59e0b";

export function AdmFormsModal({
  formsFor,
  onClose,
  onOpenForm,
  dismissable = true,
}: {
  formsFor: AdmReferralRow | null;
  onClose: () => void;
  onOpenForm: (f: AdmReferralForm, r: AdmReferralRow) => void;
  /** False while a form preview sits on top — the sheet must survive that close. */
  dismissable?: boolean;
}) {
  return (
    <KanbanOverlay
      open={formsFor !== null}
      onClose={onClose}
      dismissable={dismissable}
      title={formsFor ? `Linked forms — ${formsFor.student}` : "Linked forms"}
      description={
        formsFor ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <Pill label="LRN" className="tabular-nums">
              {formsFor.lrn}
            </Pill>
            {formsFor.section ? (
              <Pill tone="amber" label="Section">
                {formsFor.section}
              </Pill>
            ) : null}
          </span>
        ) : undefined
      }
      width="2xl"
    >
      {formsFor && formsFor.forms && formsFor.forms.length > 0 ? (
        <div className={styles.formCardGrid}>
          {formsFor.forms.map((f) => {
            const isAnecdotal = f.formType === "ANECDOTAL_REPORT";
            const category = formsFor.anecdotalCategory ?? "behavioral";
            const color = isAnecdotal
              ? (ANECDOTAL_CATEGORY_COLORS[category] ?? FORM_FOLDER_COLOR)
              : FORM_FOLDER_COLOR;
            return (
              <AnecdotalRecordKanbanCard
                key={f.id}
                category={category}
                headerTitle={FORM_TYPE_LABELS[f.formType] ?? f.formType}
                studentName={formsFor.student}
                mascotSeed={formsFor.lrn}
                lrn={formsFor.lrn}
                metaText={formsFor.section || "—"}
                metaTitle={`${formsFor.lrn}${formsFor.section ? ` · ${formsFor.section}` : ""}`}
                metaLabel="Section"
                fileName={
                  f.uploadedAt ? f.uploadedAt.slice(0, 10) : f.title
                }
                fileTag={formStatusLabel(f.status)}
                headerRight={
                  <Pill tone={formStatusTone(f.status)} label="Form status">
                    {formStatusLabel(f.status)}
                  </Pill>
                }
                categoryColor={color}
                folderColor={color}
                tone={isAnecdotal ? (ANECDOTAL_CATEGORY_TONES[category] ?? 1) : 1}
                layout="horizontal"
                openLabel={`Open ${f.title} report`}
                onOpen={() => {
                  // The contents preview opens on top; this sheet stays put so
                  // closing the preview lands the user back here.
                  onOpenForm(f, formsFor);
                }}
              />
            );
          })}
        </div>
      ) : (
        <p className={styles.previewEmpty}>
          No forms linked to this endorsement.
        </p>
      )}
    </KanbanOverlay>
  );
}
