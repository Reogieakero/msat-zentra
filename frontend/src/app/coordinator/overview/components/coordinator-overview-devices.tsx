"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatElapsedShort,
  msSinceDate,
  type AdmDeviceRow,
} from "../../components/coordinator-data";
import styles from "./coordinator-overview-devices.module.css";

interface CoordinatorOverviewDevicesProps {
  issued: number | null;
  returned: number | null;
  hasData: boolean;
  isPending: boolean;
  isError: boolean;
  isRefetching: boolean;
  oldestOut: AdmDeviceRow[];
  now: number;
  onRetry: () => void;
}

export function CoordinatorOverviewDevices({
  issued,
  returned,
  hasData,
  isPending,
  isError,
  isRefetching,
  oldestOut,
  now,
  onRetry,
}: CoordinatorOverviewDevicesProps) {
  return (
    <div className={styles.card}>
      <div className={styles.panelHead}>
        <div>
          <h2 className={styles.sectionTitle}>Learning devices</h2>
          <p className={styles.sectionDesc}>
            {hasData
              ? `${issued} still out · ${returned} returned.`
              : "Tablet issuance and return ledger."}
          </p>
        </div>
        <Link className={styles.kpiBtnSolid} href="/coordinator/devices">
          See all
        </Link>
      </div>
      <div className={styles.panelBody}>
        {isPending ? (
          <div
            aria-busy="true"
            className={styles.skelList}
          >
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} style={{ width: "100%", height: "2rem" }} />
            ))}
          </div>
        ) : isError ? (
          <div className={styles.errorBlock} role="alert">
            <p className={styles.errorText}>
              We couldn&apos;t load the device summary.
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={isRefetching}
              onClick={onRetry}
            >
              {isRefetching ? "Loading…" : "Try again"}
            </Button>
          </div>
        ) : oldestOut.length === 0 ? (
          <p className={styles.emptyText}>No tablets currently issued.</p>
        ) : (
          <div className={styles.tableWrap}>
            <Table
              className={`${styles.table} ${styles.alertTable}`}
              aria-label="Longest-outstanding tablets"
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Time out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {oldestOut.map((d) => {
                  const out = msSinceDate(d.issuedDate, now);
                  return (
                    <TableRow key={d.id}>
                      <TableCell>
                        <p className={styles.cellMain}>{d.deviceType}</p>
                        <div className={`${styles.studentSub} ${styles.mono}`}>
                          {d.deviceSerial}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className={styles.cellMain}>{d.student}</p>
                        <div className={`${styles.studentSub} ${styles.mono}`}>
                          {d.lrn}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className={styles.cellMain}>{d.issuedDate}</p>
                      </TableCell>
                      <TableCell>
                        <p className={styles.cellTime} aria-live="off">
                          {out === null
                            ? "—"
                            : `${formatElapsedShort(out)} ago`}
                        </p>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
