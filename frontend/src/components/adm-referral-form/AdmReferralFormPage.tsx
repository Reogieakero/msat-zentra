"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { fetchOcForm01Detail } from "@/components/ocform01/ocform01";
import { FormSheet } from "./form-sheet";
import type { GuidanceAdmCase } from "@/services/guidance/adm.types";
import {
  buildGcForm03Data,
  clearGcForm03Draft,
  loadGcForm03Draft,
  sanitizeGcForm03Draft,
  saveGcForm03Draft,
} from "@/services/guidance/gcform03.service";
import {
  type GcForm03Data,
} from "@/services/guidance/gcform03.types";
import { GcForm03PreviewDialog } from "@/app/guidance/adm/components/GcForm03PreviewDialog";
import { AdmReferralFormFields } from "./adm-referral-form-fields";
import pageStyles from "@/app/guidance/pages.module.css";
import styles from "@/app/guidance/adm/components/guidance-adm.module.css";
import formStyles from "@/app/guidance/adm/components/referral-form-dialog.module.css";

export interface AdmReferralFormPageCase {
  adapter: GuidanceAdmCase;
  anecdotalId: string | null;
  hasActiveSession: boolean;
  lrn: string;
}

export interface AdmReferralFormDraft {
  recommendation: string;
  scheduledAt?: string;
}

export function AdmReferralFormSheet({
  open,
  onClose,
  referralId,
  backLabel,
  staffSectionTitle,
  signerLabel,
  showClinicSession,
  counselorName,
  casePending,
  caseError,
  activeCase,
  unavailableMessage,
  initialDraft,
  confirmToastDescription,
  onConfirm,
  onConfirmed,
}: {
  open: boolean;
  onClose: () => void;
  referralId: string;
  backLabel: string;
  staffSectionTitle: string;
  signerLabel: string;
  showClinicSession: boolean;
  counselorName: string;
  casePending: boolean;
  caseError: boolean;
  activeCase: AdmReferralFormPageCase | null;
  unavailableMessage: string | null;
  initialDraft: AdmReferralFormDraft;
  confirmToastDescription: string;
  onConfirm: (args: { form: GcForm03Data; scheduledAt?: string }) => Promise<void>;
  onConfirmed: () => void;
}) {

  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const reportQuery = useQuery({
    queryKey: ["gcform03-report", activeCase?.anecdotalId ?? null],
    queryFn: () => fetchOcForm01Detail(activeCase!.anecdotalId!),
    enabled: !!activeCase?.anecdotalId,
  });
  const report = reportQuery.data ?? null;
  const reportLoading = reportQuery.isPending;
  const reportError = reportQuery.isError;

  const [step, setStep] = React.useState<1 | 2>(1);
  const [form, setForm] = React.useState<GcForm03Data | null>(null);
  const [sessionDate, setSessionDate] = React.useState("");
  const [sessionTime, setSessionTime] = React.useState("");
  const [sessionError, setSessionError] = React.useState<string | null>(null);

  React.useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!open || !activeCase || !report || form) return;
    const draft = initialDraft;
    if (draft.scheduledAt) {
      setSessionDate(draft.scheduledAt.slice(0, 10));
      setSessionTime(draft.scheduledAt.slice(11, 16));
    }
    const base = buildGcForm03Data(
      activeCase.adapter,
      report,
      draft.recommendation,
      counselorName
    );
    setForm(sanitizeGcForm03Draft(loadGcForm03Draft(referralId), base));
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCase, report, form, referralId]);

  const patch = (p: Partial<GcForm03Data>) =>
    setForm((f) => (f ? { ...f, ...p } : f));

  React.useEffect(() => {
    if (!mounted || !form) return;
    const t = window.setTimeout(() => saveGcForm03Draft(referralId, form), 250);
    return () => window.clearTimeout(t);
  }, [form, referralId, mounted]);

  function resolveSession(): string | undefined {
    if (!showClinicSession) return undefined;
    if (!sessionDate && !sessionTime) return undefined;
    if (!sessionDate || !sessionTime) {
      setSessionError("Pick both a date and a time for the clinic session — or leave both empty to forward without one.");
      return null as unknown as undefined;
    }
    if (activeCase?.hasActiveSession) {
      setSessionError("This referral already has a session that is not done yet — finish or cancel it before booking another one.");
      return null as unknown as undefined;
    }
    const at = new Date(`${sessionDate}T${sessionTime}:00`);
    if (Number.isNaN(at.getTime())) {
      setSessionError("Pick a valid date and time for the clinic session.");
      return null as unknown as undefined;
    }
    if (at.getTime() <= Date.now()) {
      setSessionError("Clinic session must be set in the future.");
      return null as unknown as undefined;
    }
    setSessionError(null);
    return `${sessionDate}T${sessionTime}:00`;
  }

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error("NO_FORM");

      if (activeCase?.hasActiveSession) throw new Error("ACTIVE_SESSION");
      const scheduledAt = resolveSession();
      if (scheduledAt === (null as unknown as undefined)) {
        throw new Error("INVALID_SESSION");
      }
      await onConfirm({ form, scheduledAt });
    },
    onSuccess: () => {
      clearGcForm03Draft(referralId);
      toast.success({
        title: "Referral confirmed",
        description: confirmToastDescription,
      });
      setStep(1);
      onConfirmed();
    },
  });

  function handleReset() {
    if (!activeCase || !report) return;
    clearGcForm03Draft(referralId);
    setSessionDate("");
    setSessionTime("");
    setSessionError(null);
    setForm(buildGcForm03Data(activeCase.adapter, report, "", counselorName));
  }

  if (!open) return null;

  if (!mounted || casePending || reportLoading) {
    return (
      <FormSheet onClose={onClose}>
      <section className={pageStyles.page} aria-busy="true">
        <div className={pageStyles.header}>
          <div>
            <p className={pageStyles.eyebrow}>ADM · Referral form</p>
            <h1 className={pageStyles.title}>GCForm-03</h1>
            <p className={pageStyles.lede}>Loading the case and its anecdotal report…</p>
          </div>
        </div>
        <Card className={pageStyles.card}>
          <CardContent>
            <div className={formStyles.form} aria-hidden="true">
              <Skeleton style={{ width: "40%", height: "1rem" }} />
              <Skeleton style={{ width: "100%", height: "4rem" }} />
              <Skeleton style={{ width: "100%", height: "4rem" }} />
              <Skeleton style={{ width: "60%", height: "2rem" }} />
            </div>
          </CardContent>
        </Card>
      </section>
      </FormSheet>
    );
  }

  if (caseError || !activeCase || reportError || (!report && !reportLoading)) {
    return (
      <FormSheet onClose={onClose}>
      <section className={pageStyles.page}>
        <div className={pageStyles.header}>
          <div>
            <p className={pageStyles.eyebrow}>ADM · Referral form</p>
            <h1 className={pageStyles.title}>GCForm-03</h1>
          </div>
        </div>
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>
            {unavailableMessage ??
              "We couldn't load the referral form. Check your connection and try again."}
          </p>
          <Button size="sm" variant="outline" onClick={onClose}>
            {backLabel}
          </Button>
        </div>
      </section>
      </FormSheet>
    );
  }

  return (
    <FormSheet onClose={onClose}>
    <section className={pageStyles.page}>
      <div className={pageStyles.header}>
        <div>
          <p className={pageStyles.eyebrow}>ADM · Referral form</p>
          <h1 className={pageStyles.title}>GCForm-03 — {activeCase.adapter.student}</h1>
          <p className={pageStyles.lede}>
            {step === 1
              ? "Answer the form's questions — names, dates, and the anecdotal detail are already filled in."
              : "Filled referral sheet preview — print it, download the .xlsx, or confirm to save and endorse the case to the ADM coordinator."}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onClose}>
          {backLabel}
        </Button>
      </div>

      {confirmMutation.isError ? (
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>
            {confirmMutation.error instanceof Error &&
            confirmMutation.error.message === "ACTIVE_SESSION"
              ? "Finish or cancel the upcoming session (or follow-up) before confirming this referral."
              : confirmMutation.error instanceof Error &&
                confirmMutation.error.message === "INVALID_SESSION"
                ? "Pick both a session date and time — or leave both empty."
                : "Sorry — saving the referral did not go through. Please try again."}
          </p>
        </div>
      ) : null}

      {activeCase?.hasActiveSession ? (
        <div className={styles.errorBlock} style={{ borderStyle: "solid" }} role="alert">
          <p className={styles.errorText} style={{ fontWeight: 600 }}>
            Not ready to confirm yet — finish or cancel the upcoming session (or follow-up) first, then come back.
          </p>
        </div>
      ) : null}

      {form && step === 1 ? (
        <AdmReferralFormFields
          form={form}
          patch={patch}
          sessionDate={sessionDate}
          sessionTime={sessionTime}
          sessionError={sessionError}
          setSessionDate={setSessionDate}
          setSessionTime={setSessionTime}
          showClinicSession={showClinicSession}
          activeCase={activeCase}
          staffSectionTitle={staffSectionTitle}
          signerLabel={signerLabel}
          onPreview={() => setStep(2)}
          onReset={handleReset}
        />
      ) : null}

      {form ? (
        <GcForm03PreviewDialog
          open={step === 2}
          data={form}
          confirming={confirmMutation.isPending}
          onClose={() => setStep(1)}
          onConfirm={() => confirmMutation.mutate()}
        />
      ) : null}
    </section>
    </FormSheet>
  );
}
