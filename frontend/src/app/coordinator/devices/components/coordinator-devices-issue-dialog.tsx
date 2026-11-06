"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, Loader2, TabletSmartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useDock } from "@/components/dock/dock-store";
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
  const { startTask, completeTask, failTask } = useDock();
  const dockTaskRef = React.useRef<string | null>(null);

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

  const close = React.useCallback(() => {
    setProfileId("");
    setDeviceSerial("");
    setConditionNotes("");
    setIssueError(null);
    setCandidateQuery("");
    onClose();
  }, [onClose]);

  const issueMutation = useMutation({
    mutationFn: async (vars: {
      admLearnerProfileId: string;
      deviceType: string;
      deviceSerial: string;
      conditionNotes?: string;
    }) => {
      const { data } = await apiClient.post("/api/adm/devices/issue", vars);
      return data;
    },
    onSuccess: (data, vars) => {
      const newId =
        typeof (data as { id?: unknown })?.id === "string"
          ? (data as { id: string }).id
          : null;
      if (newId) markSelfNotified(newId);
      if (dockTaskRef.current) {
        completeTask(dockTaskRef.current, "Device recorded as issued.");
        dockTaskRef.current = null;
      }
      onIssued();
      toast.success({
        title: "Device issued",
        description: `Serial ${vars.deviceSerial} recorded as issued.`,
      });
    },
    onError: (err) => {
      const message = apiErrorMessage(err);
      if (dockTaskRef.current) {
        failTask(dockTaskRef.current, message);
        dockTaskRef.current = null;
      }
      setIssueError(message);
      toast.error({ title: "Could not issue device", description: message });
    },
  });

  const submit = () => {
    const serial = deviceSerial.trim();
    if (!profileId || !serial) {
      setIssueError(
        "Select an approved learner case and enter the device serial number.",
      );
      return;
    }
    dockTaskRef.current = startTask({
      kind: "generic",
      title: "Issuing learning device",
      description: `${deviceType.trim()} · ${serial}${
        selectedCandidate ? ` · ${selectedCandidate.student}` : ""
      }`,
    });
    issueMutation.mutate({
      admLearnerProfileId: profileId,
      deviceType: deviceType.trim(),
      deviceSerial: serial,
      ...(conditionNotes.trim()
        ? { conditionNotes: conditionNotes.trim() }
        : {}),
    });
    close();
  };

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !issueMutation.isPending) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, issueMutation.isPending, close]);

  if (!open) return null;

  return (
    <div className={styles.overlay}>
      <div
        className={styles.backdrop}
        onClick={() => {
          if (!issueMutation.isPending) close();
        }}
        aria-hidden="true"
      />

      {/* Kanban board shell — muted outer card, inner detail panel, no shadow. */}
      <div
        className={styles.board}
        role="dialog"
        aria-modal="true"
        aria-label="Issue device"
      >
        <div className={styles.head}>
          <span className={styles.headIcon} aria-hidden="true">
            <TabletSmartphone size={15} />
          </span>
          <p className={styles.headTitle}>Issue device</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 shrink-0 px-0"
            onClick={close}
            disabled={issueMutation.isPending}
            aria-label="Close"
          >
            <X size={14} aria-hidden />
          </Button>
        </div>
        <p className={styles.headDesc}>
          Records a learning device as issued to a principal-approved ADM
          learner with no device yet.
        </p>

        <div className={styles.body}>
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
                  className="z-[70]"
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
                <DropdownMenuContent align="start" className="z-[70]">
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
        </div>

        <div className={styles.actions}>
          <Button
            size="sm"
            className="h-6 px-2.5 text-xs"
            aria-busy={issueMutation.isPending || undefined}
            disabled={
              issueMutation.isPending ||
              !profileId ||
              !deviceType.trim() ||
              !deviceSerial.trim()
            }
            onClick={submit}
          >
            {issueMutation.isPending ? (
              <Loader2 className={styles.spin} aria-hidden="true" />
            ) : null}
            {issueMutation.isPending ? "Issuing…" : "Issue device"}
          </Button>
        </div>
      </div>
    </div>
  );
}
