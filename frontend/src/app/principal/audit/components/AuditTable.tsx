import * as React from "react";
import { ChevronRight, Lock } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ACTION_LABELS,
  ROLE_LABELS,
  AuditEntry,
  isConfidentialTable,
} from "../audit-data";
import { buildChangeLines, summarizeAction } from "../format-change";
import { AuditDrawer } from "./AuditDrawer";
import styles from "./audit-table.module.css";

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DiffCard({
  title,
  lines,
}: {
  title: string;
  lines: { label: string; value: string }[];
}) {
  return (
    <div className={styles.diffCol}>
      <span className={styles.diffLabel}>{title}</span>
      {lines.length === 0 ? (
        <p className={styles.diffEmpty}>No values recorded.</p>
      ) : (
        <dl className={styles.diffFields}>
          {lines.map((line) => (
            <div className={styles.diffField} key={line.label}>
              <dt className={styles.diffFieldLabel}>{line.label}</dt>
              <dd className={styles.diffFieldValue}>{line.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function FriendlyDiff({ entry }: { entry: AuditEntry }) {
  const lines = buildChangeLines(entry);
  const fromLines = lines.map((l) => ({ label: l.label, value: l.from }));
  const toLines = lines.map((l) => ({ label: l.label, value: l.to }));
  return (
    <div className={styles.diff}>
      <p className={styles.diffSummary}>{summarizeAction(entry)}</p>
      <div className={styles.diffCards}>
        <DiffCard title="Before" lines={fromLines} />
        <div className={styles.diffArrow} aria-hidden>
          →
        </div>
        <DiffCard title="After" lines={toLines} />
      </div>
    </div>
  );
}

export function AuditTable({
  entries,
  currentUser,
}: {
  entries: AuditEntry[];
  currentUser: string;
}) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [drawerEntry, setDrawerEntry] = React.useState<AuditEntry | null>(null);

  return (
    <>
      <div className={styles.wrap}>
        <Table>
          <TableHeader>
            <TableRow className={styles.headRow}>
              <TableHead className={styles.expandCol} />
              <TableHead className={styles.colTimestamp}>Timestamp</TableHead>
              <TableHead className={styles.colActor}>Actor</TableHead>
              <TableHead className={styles.colRole}>Role</TableHead>
              <TableHead className={styles.colAction}>Action</TableHead>
              <TableHead className={styles.colSource}>Source</TableHead>
              <TableHead className={styles.colReason}>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const expanded = expandedId === entry.id;
              const confidential = isConfidentialTable(entry.sourceTable);
              return (
                <React.Fragment key={entry.id}>
                  <TableRow
                    className={styles.row}
                    aria-expanded={expanded}
                    onClick={() => setExpandedId(expanded ? null : entry.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <TableCell className={styles.expandCol}>
                      <ChevronRight
                        className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}
                        aria-hidden
                      />
                    </TableCell>
                    <TableCell className={`${styles.mono} ${styles.colTimestamp}`} data-label="Timestamp">
                      {formatTimestamp(entry.timestamp)}
                    </TableCell>
                    <TableCell className={styles.colActor} data-label="Actor">{entry.user}</TableCell>
                    <TableCell className={styles.colRole} data-label="Role">
                      <Badge variant="outline" className={styles.roleBadge}>
                        {ROLE_LABELS[entry.actorRole]}
                      </Badge>
                    </TableCell>
                    <TableCell className={styles.colAction} data-label="Action">{ACTION_LABELS[entry.actionType]}</TableCell>
                    <TableCell className={styles.colSource} data-label="Source">
                      {entry.sourceLabel}
                    </TableCell>
                    <TableCell className={`${styles.reason} ${styles.colReason}`} data-label="Reason">
                      <span className={styles.reasonText} title={entry.reason}>
                        {entry.reason}
                      </span>
                    </TableCell>
                  </TableRow>
                  {expanded ? (
                    <TableRow className={styles.detailRow} onClick={(e) => e.stopPropagation()}>
                      <TableCell />
                      <TableCell colSpan={6}>
                        <div className={styles.detail}>
                          <FriendlyDiff entry={entry} />
                          <button
                            type="button"
                            className={styles.drillButton}
                            onClick={() => setDrawerEntry(entry)}
                          >
                            {confidential ? (
                              <>
                                <Lock className={styles.lockIcon} aria-hidden />
                                View source (status-only)
                              </>
                            ) : (
                              <>View source record #{entry.sourceId}</>
                            )}
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AuditDrawer
        entry={drawerEntry}
        currentUser={currentUser}
        onClose={() => setDrawerEntry(null)}
      />
    </>
  );
}
