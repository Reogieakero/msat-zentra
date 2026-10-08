"use client";
import * as React from "react";
import { SearchIcon } from "lucide-react";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { toast } from "@/components/ui/sonner";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type {
  AdmReferralForm,
  AdmReferralRow,
} from "@/services/principal/adm.types";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { GcForm03PreviewDialog } from "@/app/guidance/adm/components/GcForm03PreviewDialog";
import { SignReturnConfirmDialog } from "./SignReturnConfirmDialog";
import { PrincipalPageHeader } from "../../../components/PrincipalPageHeader";
import styles from "./all.module.css";
import assign from "../../../academics/assign/components/section-assignments.module.css";
import { useAdmReferralsList } from "./components/use-adm-referrals-list";
import { useGcForm03Opener } from "./components/use-gc-form-03-opener";
import { AdmReferralsTable } from "./components/adm-referrals-table";
import { AdmFormsModal } from "./components/adm-forms-modal";
import { AdmPreviewModal, type AdmPreviewState } from "./components/adm-preview-modal";
export default function PrincipalAdmReferralsAllPage() {
  const queryClient = useQueryClient();
  const [actionId, setActionId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const { rows, setRows, totalCount, totalPages, safePage, start, end, loading, error, load } =
    useAdmReferralsList(search, page);
  const { gcOpen, setGcOpen, gcData, openGcForm03 } = useGcForm03Opener();
  const [pendingAction, setPendingAction] = React.useState<{
    id: string;
    type: "sign" | "return";
  } | null>(null);
  const [preview, setPreview] = React.useState<AdmPreviewState | null>(null);
  const [officialFormId, setOfficialFormId] = React.useState<string | null>(null);
  const [formsFor, setFormsFor] = React.useState<AdmReferralRow | null>(null);
  const openForm = React.useCallback(
    (f: AdmReferralForm, r: AdmReferralRow) => {
      if (f.formType === "ANECDOTAL_REPORT" && r.anecdotalRecordId) {
        setOfficialFormId(r.anecdotalRecordId);
        return;
      }
      if (f.formType === "REFERRAL_FORM" && r.anecdotalRecordId) {
        void openGcForm03(r);
        return;
      }
      setPreview({
        form: f,
        student: r.student,
        lrn: r.lrn,
        anecdotalRecordId: r.anecdotalRecordId ?? null,
      });
    },
    [openGcForm03],
  );
  const handleSign = (id: string) => {
    if (actionId) return;
    setActionId(id);
    return apiClient
      .post(`/api/adm/${id}/principal-approve`)
      .then(() => {
        setRows((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  approvedBy: "Principal",
                  approvalDate: new Date().toISOString().slice(0, 10),
                }
              : r,
          ),
        );
        void queryClient.invalidateQueries({ queryKey: ["adm-dashboard"] });
        toast.success({ title: "Signed — moved to monitoring" });
        return load(page);
      })
      .catch((err: unknown) => {
        console.error("[/api/adm principal-approve] failed:", err);
        toast.error({
          title: "Sign failed",
          description: "Could not approve this case.",
        });
      })
      .finally(() => setActionId(null));
  };
  const handleReturn = (id: string) => {
    if (actionId) return;
    setActionId(id);
    return apiClient
      .post(`/api/adm/${id}/principal-return`)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ["adm-dashboard"] });
        toast.success({ title: "Returned to ADM Coordinator" });
        return load(page);
      })
      .catch((err: unknown) => {
        console.error("[/api/adm principal-return] failed:", err);
        toast.error({
          title: "Return failed",
          description: "Could not return this case.",
        });
      })
      .finally(() => setActionId(null));
  };
  const pendingRow =
    pendingAction && rows.find((r) => r.id === pendingAction.id);
  return (
    <section aria-label="ADM cases" className="flex min-w-0 flex-col gap-3">
      <PrincipalPageHeader
        title="ADM Referrals"
        description="Cases the ADM Coordinator endorsed upward — review, sign, or return for revision."
      />
      <div className={assign.card}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className={styles.sectionTitle}>Endorsed ADM Cases</h2>
            <p className={styles.sectionDesc} aria-live="polite">
              {totalCount === 0
                ? "No ADM referrals on record."
                : `${totalCount} case${totalCount === 1 ? "" : "s"} endorsed by the ADM Coordinator — signed cases stay on this list and are final.`}
            </p>
          </div>
          <InputGroup className="max-w-40 shrink-0">
            <InputGroupInput
              placeholder="Search name, LRN, or ID…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label="Search referrals"
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
        </div>
        <AdmReferralsTable
          rows={rows}
          totalCount={totalCount}
          loading={loading}
          error={error}
          search={search}
          actionId={actionId}
          safePage={safePage}
          totalPages={totalPages}
          start={start}
          end={end}
          onRequestSign={(id) => setPendingAction({ id, type: "sign" })}
          onRequestReturn={(id) => setPendingAction({ id, type: "return" })}
          onViewForms={(r) => setFormsFor(r)}
          onPrev={() => load(safePage - 1)}
          onNext={() => load(safePage + 1)}
        />
      </div>
      <AdmPreviewModal
        preview={preview}
        onClose={() => setPreview(null)}
        onOpenOfficial={(id) => setOfficialFormId(id)}
      />
      <AdmFormsModal
        formsFor={formsFor}
        onClose={() => setFormsFor(null)}
        onOpenForm={openForm}
      />
      <OcForm01PreviewDialog
        recordId={officialFormId}
        onClose={() => setOfficialFormId(null)}
      />
      <GcForm03PreviewDialog
        open={gcOpen}
        data={gcData}
        confirming={false}
        onClose={() => setGcOpen(false)}
        onConfirm={() => setGcOpen(false)}
        viewOnly
      />
      <SignReturnConfirmDialog
        pendingAction={pendingAction}
        busyActionId={actionId}
        pendingRow={pendingRow}
        onClose={() => setPendingAction(null)}
        onConfirm={(target) => {
          setPendingAction(null);
          if (target.type === "sign") void handleSign(target.id);
          else void handleReturn(target.id);
        }}
      />
    </section>
  );
}
