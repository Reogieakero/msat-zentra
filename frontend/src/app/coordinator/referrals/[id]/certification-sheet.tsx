"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { apiErrorMessage } from "../../components/coordinator-data";
import styles from "./case-page.module.css";

export interface CertSheetContext {
  profileId: string;
  student: string;
  hasReferral: boolean;
  hasAnecdotal: boolean;
  meetingAttended: boolean;
}

interface CertificationSheetProps {
  open: boolean;
  context: CertSheetContext | null;
  onClose: () => void;
  onCertified: () => void;
}

/**
 * ADM certification fill-up — slides in right after the parent meeting is
 * confirmed attended (no home visitation needed). Records the
 * coordinator's recommendation and moves the case into the certification
 * stage in one step.
 */
export function CertificationSheet({
  open,
  context,
  onClose,
  onCertified,
}: CertificationSheetProps) {
  const queryClient = useQueryClient();
  const [recommendation, setRecommendation] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // Fresh form every time the sheet opens for a case.
  const openKey = open && context ? context.profileId : null;
  const [prevOpenKey, setPrevOpenKey] = React.useState<string | null>(null);
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    setRecommendation("");
    setError(null);
  }

  const certifyMutation = useMutation({
    mutationFn: async () => {
      if (!context) throw new Error("No case selected.");
      const { data } = await apiClient.post(
        `/api/adm/${context.profileId}/certification`,
        { recommendation: recommendation.trim() },
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["coordinator-certifications"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["coordinator-dashboard"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["coordinator-referrals"],
      });
      onClose();
      onCertified();
      toast.success({
        title: "Certification created",
        description:
          "The case is now with the Principal for signature.",
      });
    },
    onError: (err) =>
      toast.error({
        title: "Could not record certification",
        description: apiErrorMessage(err),
      }),
  });

  function save() {
    if (certifyMutation.isPending) return;
    if (recommendation.trim().length < 10) {
      setError("Write the recommendation (at least 10 characters).");
      return;
    }
    setError(null);
    certifyMutation.mutate();
  }

  const evidence = context
    ? [
        { label: "Referral on file", ok: context.hasReferral },
        { label: "Anecdotal report on file", ok: context.hasAnecdotal },
        { label: "Parent meeting attended", ok: context.meetingAttended },
      ]
    : [];
  const missing = evidence.filter((e) => !e.ok);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>ADM certification</SheetTitle>
          <SheetDescription>
            {context ? (
              <>
                Recommendation for {context.student} — creating it passes
                the case to the Principal for signature.
              </>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        <div className={styles.sheetBody}>
          <div>
            <p className={styles.sheetSectionTitle}>Evidence chain</p>
            <ul className={styles.evidenceList}>
              {evidence.map((e) => (
                <li key={e.label} className={styles.evidenceItem}>
                  <Badge variant={e.ok ? "success" : "outline"}>
                    {e.ok ? "On file" : "Missing"}
                  </Badge>
                  <span>{e.label}</span>
                </li>
              ))}
            </ul>
            {missing.length > 0 ? (
              <p className={styles.muted} style={{ margin: "0.5rem 0 0" }}>
                Missing evidence flags the case for revision — you can still
                certify now and complete it after.
              </p>
            ) : null}
          </div>

          <div>
            <label
              className={styles.metaLabel}
              htmlFor="cert-recommendation"
            >
              Recommendation
            </label>
            <Textarea
              id="cert-recommendation"
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              placeholder="State the findings and the ADM recommendation…"
              rows={6}
            />
          </div>

          {error ? (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div
          className={styles.attendBtns}
          style={{ marginTop: "auto", padding: "0 1rem 1rem" }}
        >
          <Button
            variant="destructive"
            className={styles.btnRed}
            onClick={onClose}
            disabled={certifyMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            disabled={certifyMutation.isPending}
            aria-busy={certifyMutation.isPending || undefined}
            onClick={save}
          >
            {certifyMutation.isPending ? (
              <Loader2
                className="animate-spin"
                aria-hidden="true"
                style={{ width: "0.875rem", height: "0.875rem" }}
              />
            ) : null}
            {certifyMutation.isPending ? "Certifying…" : "Create certification"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
