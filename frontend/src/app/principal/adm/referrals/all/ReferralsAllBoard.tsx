"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AdmBrowser, CaseTable } from "../../AdmBoard";
import {
  MOCK_ADM_CASES,
  type AdmCase,
} from "../../mockData";
import { DOC_LEGEND, DocumentCard } from "../../components/DocumentCard";
import { ADM_DOCUMENTS } from "../../mockData";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import shared from "../../../academics/academics.module.css";
import styles from "./all.module.css";
import header from "../../components/admHeader.module.css";
import dialog from "../../components/admDialog.module.css";
import legend from "../../components/admLegend.module.css";
import menu from "../../components/admCardMenu.module.css";

const REFERRAL_STAGES = [
  "referred",
  "eligibility",
  "consultation",
  "principal_approval",
] as const;

function useReferralsAllBoard() {
  const [cases, setCases] = React.useState<AdmCase[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<{
    id: string;
    type: "sign" | "return";
  } | null>(null);

  const allReferred = React.useMemo(
    () =>
      [...cases]
        .filter((c) => (REFERRAL_STAGES as readonly string[]).includes(c.stage))
        .sort((a, b) => b.datePrepared.localeCompare(a.datePrepared)),
    [cases]
  );

  React.useEffect(() => {
    setCases(MOCK_ADM_CASES);
    setLoading(false);
  }, []);

  const handleSign = (id: string) =>
    setCases((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              approvedBy: "Principal",
              approvalDate: "2026-08-27",
              stage: "enrollment_monitoring",
            }
          : c
      )
    );

  const handleReturn = (id: string) =>
    setCases((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, stage: "eligibility", eligibilityStatus: "pending" } : c
      )
    );

  const confirmPending = () => {
    if (!pendingAction) return;
    if (pendingAction.type === "sign") handleSign(pendingAction.id);
    else handleReturn(pendingAction.id);
    setPendingAction(null);
  };

  return {
    cases,
    loading,
    allReferred,
    selectedId,
    setSelectedId,
    pendingAction,
    setPendingAction,
    confirmPending,
  };
}

export function ReferralsAllBoard() {
  const board = useReferralsAllBoard();
  const router = useRouter();

  return (
    <section className={styles.page}>
      <div className={header.headerRow}>
        <div className={`${header.headerText} ${styles.headerText}`}>
          <h1 className={header.headerTitle}>ADM Referrals</h1>
          <p className={header.headerSub}>
            Every learner referral in the ADM pipeline — status-only, full list.
          </p>
        </div>
        <div className={header.headerActions}>
          <div className={menu.menuCard}>
            <div className={menu.menuHead}>
              <span className={menu.menuTitle}>Document Legend</span>
            </div>
            <div className={legend.docLegend}>
              {DOC_LEGEND.map((item) => (
                <span key={item.label} className={legend.docLegendItem}>
                  <span
                    className={legend.docLegendSwatch}
                    style={{ background: item.color }}
                  />
                  <span className={legend.docLegendLabel}>{item.label}</span>
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            className={header.seeAllBtn}
            onClick={() => router.push("/principal/adm")}
          >
            Back to board
          </button>
        </div>
      </div>

      <AdmBrowser
        tabs={[{ id: "all", label: "All Referrals" }]}
        activeTab="all"
        onTabChange={() => {}}
      >
        <CaseTable
          rows={board.allReferred}
          loading={board.loading}
          emptyLabel="No referrals yet."
          onSelect={board.setSelectedId}
          onRequestAction={(id, type) => board.setPendingAction({ id, type })}
        />
      </AdmBrowser>

      <AlertDialog
        open={board.pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) board.setPendingAction(null);
        }}
      >
        <AlertDialogContent size="default" className={dialog.dialogWide}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {board.pendingAction?.type === "sign"
                ? "Sign & approve this case?"
                : "Return this case for revision?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {board.pendingAction?.type === "sign"
                ? "You are final-signing this ADM profile. This authorizes module release and moves the case to monitoring."
                : "The case will be sent back to the ADM Coordinator at the eligibility stage."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(() => {
            const pendingCase =
              board.pendingAction &&
              board.cases.find((c) => c.id === board.pendingAction!.id);
            if (!pendingCase) return null;
            return (
              <div className={dialog.dialogDocs}>
                <span className={dialog.dialogDocsName}>
                  {pendingCase.student}{" "}
                  <span className={shared.mono}>({pendingCase.lrn})</span>
                </span>
                <div className={dialog.dialogDocsRow}>
                  {ADM_DOCUMENTS.map((doc, i) => (
                    <DocumentCard
                      key={doc.name}
                      doc={doc}
                      style={{ animationDelay: `${Math.min(i, 24) * 80}ms` }}
                    />
                  ))}
                </div>
              </div>
            );
          })()}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                board.pendingAction?.type === "sign"
                  ? dialog.alertSign
                  : dialog.alertReturn
              }
              onClick={board.confirmPending}
            >
              {board.pendingAction?.type === "sign" ? "Sign & Approve" : "Confirm Return"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export default function PrincipalAdmReferralsAllPage() {
  return <ReferralsAllBoard />;
}
