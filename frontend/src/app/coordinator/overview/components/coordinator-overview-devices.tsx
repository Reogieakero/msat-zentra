"use client";

import Link from "next/link";
import { Loader2, TabletSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatElapsedShort, msSinceDate } from "@/lib/clock";
import type { AdmDeviceRow } from "@/services/coordinator/coordinator.types";
import { CoordinatorEmptyState } from "../../components/CoordinatorEmptyCard";
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

function buildInterpretation(
  oldestOut: AdmDeviceRow[],
  issued: number | null,
  now: number,
): string {
  if (oldestOut.length === 0) {
    return "No tablets are currently issued — the ledger is clear.";
  }
  const elapsedList = oldestOut
    .map((d) => msSinceDate(d.issuedDate, now))
    .filter((v): v is number => v !== null);
  const longest =
    elapsedList.length > 0 ? formatElapsedShort(Math.max(...elapsedList)) : null;
  const total = issued ?? oldestOut.length;
  return (
    `${total} tablet${total === 1 ? "" : "s"} still out.` +
    (longest ? ` Longest outstanding ${longest} ago — follow up with that learner first.` : "")
  );
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
  const isEmpty = !isPending && !isError && oldestOut.length === 0;
  return (
    <Card className={styles.card}>
      <span className={styles.glowClip} aria-hidden="true">
        <span className={styles.cardGlow} />
      </span>
      {!isEmpty && (
        <CardHeader>
          <div className={styles.headerRow}>
            <div>
              <CardTitle className={styles.sectionTitle}>Learning devices</CardTitle>
              <CardDescription className={styles.sectionDesc}>
                {hasData
                  ? `${issued} still out · ${returned} returned.`
                  : "Tablet issuance and return ledger."}
              </CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/coordinator/devices">See all</Link>
            </Button>
          </div>
        </CardHeader>
      )}
      <CardContent className={styles.body}>
        {isPending ? (
          <div className={styles.tableWrap} aria-busy="true">
            <table className={styles.skelTable} aria-hidden="true">
              <tbody>
                {[0, 1, 2].map((i) => (
                  <tr key={i}>
                    <td>
                      <Skeleton style={{ width: "100%", height: "2rem" }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              {isRefetching ? (
                <Loader2 className={styles.spin} aria-hidden="true" />
              ) : null}
              {isRefetching ? "Loading…" : "Try again"}
            </Button>
          </div>
        ) : oldestOut.length === 0 ? (
          <CoordinatorEmptyState
            icon={TabletSmartphone}
            title="No tablets currently issued"
            hint="Newly issued tablets will appear here, longest-out first."
          />
        ) : (
          <div className={styles.tableWrap}>
            <Table aria-label="Longest-outstanding tablets">
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
                        <p className={`${styles.cellSub} ${styles.mono}`}>
                          {d.deviceSerial}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className={styles.cellMain}>{d.student}</p>
                        <p className={`${styles.cellSub} ${styles.mono}`}>
                          {d.lrn}
                        </p>
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
        {!isPending && !isError && !isEmpty ? (
          <p className={styles.interpretation}>
            <span className={styles.interpretationLabel}>What it means · </span>
            {buildInterpretation(oldestOut, issued, now)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
