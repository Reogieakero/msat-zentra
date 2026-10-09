"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TabletSmartphone } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import type { AdmApprovalsPage } from "@/services/coordinator/coordinator.types";
import styles from "./coordinator-sidebar-reminder.module.css";

interface NeedsDeviceCase {
  id: string;
  student: string;
  approvalDate: string | null;
}

function useNeedsDeviceCases(): NeedsDeviceCase[] {
  const [cases, setCases] = React.useState<NeedsDeviceCase[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    const load = () => {
      apiClient
        .get<AdmApprovalsPage>("/api/adm/approvals", {
          // Strict 15-record ceiling for sidebar preview.
          params: { limit: 15 },
        })
        .then(({ data }) => {
          if (cancelled || !data || !Array.isArray(data.rows)) return;
          setCases(
            data.rows
              .filter((r) => (r.devicesIssued ?? 0) === 0)
              .map((r) => ({
                id: r.id,
                student: r.student,
                approvalDate: r.approvalDate,
              })),
          );
        })
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, 30_000);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, []);

  return cases;
}

function formatApprovalDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CoordinatorSidebarDeviceReminder() {
  const router = useRouter();
  const cases = useNeedsDeviceCases();

  const current = cases[0] ?? null;
  const extraCount = cases.length > 1 ? cases.length - 1 : 0;

  if (!current) return null;

  const approved = formatApprovalDate(current.approvalDate);
  const message = approved
    ? `${current.student} — approved ${approved}, no device issued yet`
    : `${current.student} — approved, no device issued yet`;

  return (
    <div className={styles.card} role="alert" aria-live="polite">
      <div className={styles.visual} aria-hidden="true">
        <span className={styles.visualInner}>
          <span className={styles.visualIcon}>
            <TabletSmartphone size={12} strokeWidth={2} />
          </span>
          <span className={styles.liveDot} />
          <span>Needs device</span>
        </span>
      </div>
      <div className={styles.body}>
        <p className={styles.title}>A learner needs a device.</p>
        <p className={styles.message}>{message}</p>
        {extraCount > 0 ? (
          <p className={styles.meta}>
            <span className={styles.metaCount}>+{extraCount}</span>
            <span>
              {extraCount === 1 ? "more case" : "more cases"} waiting
            </span>
          </p>
        ) : null}
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.cta}
          onClick={() => router.push("/coordinator/devices?issue=1")}
        >
          Issue device
        </button>
      </div>
    </div>
  );
}
