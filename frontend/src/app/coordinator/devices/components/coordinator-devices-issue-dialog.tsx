"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardModal } from "@/components/ui/CardModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { markSelfNotified } from "@/lib/realtime/coordinatorChannel";
import { apiErrorMessage } from "@/lib/api/errors";
import type { AdmApprovalRow } from "@/services/coordinator/coordinator.types";
import styles from "./coordinator-devices-issue-dialog.module.css";

const DEVICE_TYPE_OPTIONS = ["Tablet", "Phone", "Laptop", "Chromebook"] as const;

interface CoordinatorDevicesIssueDialogProps {
  open: boolean;

  candidates: AdmApprovalRow[];
  candidatesPending: boolean;
  onClose: () => void;

  onIssued: () => void;
}

export function CoordinatorDevicesIssueDialog({
  open,
  candidates,
  candidatesPending,
  onClose,
  onIssued,
}: CoordinatorDevicesIssueDialogProps) {
  const [profileId, setProfileId] = React.useState("");
  const [deviceType, setDeviceType] = React.useState<string>("Tablet");
  const [deviceSerial, setDeviceSerial] = React.useState("");
  const [conditionNotes, setConditionNotes] = React.useState("");
  const [issueError, setIssueError] = React.useState<string | null>(null);
  const [candidateQuery, setCandidateQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = candidateQuery.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (r) =>
        r.student.toLowerCase().includes(q) ||
        r.lrn.toLowerCase().includes(q),
    );
  }, [candidates, candidateQuery]);
  const selectedCandidate =
    candidates.find((r) => r.id === profileId) ?? null;

  const close = () => {
    setProfileId("");
    setDeviceSerial("");
    setConditionNotes("");
    setIssueError(null);
    setCandidateQuery("");
    onClose();
  };

  const issueMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post("/api/adm/devices/issue", {
        admLearnerProfileId: profileId,
        deviceType: deviceType.trim(),
        deviceSerial: deviceSerial.trim(),
        ...(conditionNotes.trim()
          ? { conditionNotes: conditionNotes.trim() }
          : {}),
      });
      return data;
    },
    onSuccess: (data) => {
      const serial = deviceSerial.trim();
      const newId =
        typeof (data as { id?: unknown })?.id === "string"
          ? (data as { id: string }).id
          : null;
      if (newId) markSelfNotified(newId);
      close();
      onIssued();
      toast.success({
        title: "Device issued",
        description: `Serial ${serial} recorded as issued.`,
      });
    },
    onError: (err) => {
      const message = apiErrorMessage(err);
      setIssueError(message);
      toast.error({ title: "Could not issue device", description: message });
    },
  });

  return (
      <CardModal
        open={open}
        onClose={close}
        dismissable={!issueMutation.isPending}
      title="Issue device"
      description="Records a learning device as issued to a principal-approved ADM learner with no device yet."
      size="sm"
    >
      <div className={styles.formGrid}>
          <div className={styles.formField}>
            <Label className={styles.formLabel} htmlFor="dev-profile">
              Approved learner case
            </Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  id="dev-profile"
                  variant="outline"
                  style={{ width: "100%", justifyContent: "space-between" }}
                >
                  <span className={styles.pickerLabel}>
                    {selectedCandidate
                      ? `${selectedCandidate.student} · ${selectedCandidate.lrn}`
                      : "Select an approved case…"}
                  </span>
                  <ChevronDown aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                style={
                  {
                    width: "var(--radix-dropdown-menu-trigger-width)",
                    maxWidth: "22rem",
                  } as React.CSSProperties
                }
              >
                <div style={{ padding: "0.375rem" }}>
                  <Input
                    placeholder="Search approved cases…"
                    value={candidateQuery}
                    onChange={(e) => setCandidateQuery(e.target.value)}
                    aria-label="Search approved cases without devices"
                    style={{ height: "2rem", fontSize: "0.8125rem" }}
                  />
                </div>

                <div style={{ padding: "0 0.625rem 0.375rem" }}>
                  {candidatesPending && filtered.length === 0 ? (
                    <DropdownMenuItem disabled>Loading cases…</DropdownMenuItem>
                  ) : filtered.length === 0 ? (
                    <DropdownMenuItem disabled>
                      {candidateQuery.trim()
                        ? "No cases match this search."
                        : "Every approved case already has a device"}
                    </DropdownMenuItem>
                  ) : (
                    filtered.map((r) => (
                      <DropdownMenuItem
                        key={r.id}
                        onSelect={() => setProfileId(r.id)}
                        title={
                          r.approvalDate
                            ? `Approved ${r.approvalDate}`
                            : "Approved by the Principal"
                        }
                      >
                        {r.student} · {r.lrn}
                        {r.approvalDate ? ` · ${r.approvalDate}` : ""}
                      </DropdownMenuItem>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className={styles.formField}>
            <Label className={styles.formLabel} htmlFor="dev-type">
              Device type
            </Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  id="dev-type"
                  variant="outline"
                  style={{ width: "100%", justifyContent: "space-between" }}
                >
                  {deviceType || "Select device type…"}
                  <ChevronDown aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {DEVICE_TYPE_OPTIONS.map((t) => (
                  <DropdownMenuItem key={t} onSelect={() => setDeviceType(t)}>
                    {t}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className={styles.formField}>
            <Label className={styles.formLabel} htmlFor="dev-serial">
              Serial number
            </Label>
            <Input
              id="dev-serial"
              value={deviceSerial}
              onChange={(e) => {
                setDeviceSerial(e.target.value);
                if (issueError) setIssueError(null);
              }}
              placeholder="e.g. SN48213"
              aria-invalid={issueError ? true : undefined}
            />
          </div>
          <div className={styles.formField}>
            <Label className={styles.formLabel} htmlFor="dev-condition">
              Condition at issuance (optional)
            </Label>
            <Input
              id="dev-condition"
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              placeholder="e.g. New, with charger and case"
            />
          </div>
        </div>
        {issueError ? (
          <p role="alert" className={styles.formError}>
            {issueError}
          </p>
        ) : null}
        <div className={styles.formFooter}>
          <Button variant="destructive" onClick={close} disabled={issueMutation.isPending}>
            Cancel
          </Button>
          <Button
            aria-busy={issueMutation.isPending || undefined}
            disabled={
              issueMutation.isPending ||
              !profileId ||
              !deviceType.trim() ||
              !deviceSerial.trim()
            }
            onClick={() => {
              if (!profileId || !deviceSerial.trim()) {
                setIssueError(
                  "Select an approved learner case and enter the device serial number.",
                );
                return;
              }
              issueMutation.mutate();
            }}
          >
            {issueMutation.isPending ? (
              <Loader2 className={styles.spin} aria-hidden="true" />
            ) : null}
            {issueMutation.isPending ? "Issuing…" : "Issue device"}
          </Button>
        </div>
    </CardModal>
  );
}
