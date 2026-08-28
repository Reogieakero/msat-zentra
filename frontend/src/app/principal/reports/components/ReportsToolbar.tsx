import * as React from "react";

import { Button } from "@/components/ui/button";
import styles from "./reports-toolbar.module.css";

export function ReportsToolbar({
  onRefresh,
  loading,
}: {
  onRefresh: () => void;
  loading?: boolean;
}) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarSpacer} />
      <div className={styles.toolbarActions}>
        <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
          <RefreshIcon />
          Refresh
        </Button>
        <Button size="sm" variant="outline">
          <DownloadIcon />
          Export
        </Button>
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}
