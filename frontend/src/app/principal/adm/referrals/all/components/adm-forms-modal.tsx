"use client";
import { FolderCard } from "@/components/ui/FolderCard";
import { CardModal } from "@/components/ui/CardModal";
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
};
export function AdmFormsModal({
  formsFor,
  onClose,
  onOpenForm,
}: {
  formsFor: AdmReferralRow | null;
  onClose: () => void;
  onOpenForm: (f: AdmReferralForm, r: AdmReferralRow) => void;
}) {
  return (
    <CardModal
      open={formsFor !== null}
      onClose={onClose}
      title={formsFor ? `Linked forms — ${formsFor.student}` : "Linked forms"}
      description={
        formsFor
          ? `${formsFor.lrn}${formsFor.section ? ` · ${formsFor.section}` : ""} · ${formsFor.forms?.length ?? 0} form${(formsFor.forms?.length ?? 0) === 1 ? "" : "s"} linked to this endorsement`
          : undefined
      }
      size="lg"
      watchKey={formsFor?.id}
    >
      {formsFor && formsFor.forms && formsFor.forms.length > 0 ? (
        <div className={styles.folderGrid}>
          {formsFor.forms.map((f) => (
            <button
              key={f.id}
              type="button"
              className={styles.folderBtn}
              onClick={() => {
                const row = formsFor;
                onClose();
                onOpenForm(f, row);
              }}
              aria-label={`Open ${f.title} report`}
            >
              <FolderCard
                label={f.title}
                sublabel={`${FORM_TYPE_LABELS[f.formType] ?? f.formType} · ${f.status}`}
                cornerTag={FORM_TYPE_LABELS[f.formType] ?? f.formType}
                folderColor="var(--primary)"
                files={[
                  {
                    name: f.uploadedAt ? f.uploadedAt.slice(0, 10) : f.title,
                    tag: f.status,
                    icon: "doc" as const,
                  },
                ]}
              />
            </button>
          ))}
        </div>
      ) : (
        <p className={styles.previewEmpty}>
          No forms linked to this endorsement.
        </p>
      )}
    </CardModal>
  );
}
