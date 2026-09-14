"use client";

import * as React from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { NurseQueueRowActions } from "../../overview/components/NurseQueueRowActions";
import { NurseAdmReviewDialog } from "../../overview/components/NurseAdmReviewDialog";
import {
  apiErrorMessage,
  forwardNurseAdmCase,
  NURSE_STATUS_LABELS,
} from "../../overview/components/nurse-overview-data";
import {
  NURSE_SEVERITY_LABELS,
  type NurseAlertItem,
  type NurseAlertSeverity,
} from "./nurse-alerts-data";
import styles from "./nurse-alerts.module.css";

const PAGE_SIZE = 5;

const SEVERITY_ORDER: NurseAlertSeverity[] = ["urgent", "new", "info", "done"];

function severityBadge(severity: NurseAlertSeverity): "destructive" | "default" | "outline" | "secondary" {
  if (severity === "urgent") return "destructive";
  if (severity === "new") return "default";
  if (severity === "done") return "secondary";
  return "outline";
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={styles.detailValue}>{value}</span>
    </div>
  );
}

// Explicit forward for ADM cases whose referral form is completed. The case
// reaches the ADM coordinator only when the nurse clicks this — saving the
// form alone never moves it.
function ForwardAdmButton({
  id,
  student,
  onChanged,
}: {
  id: string;
  student: string;
  onChanged: () => void;
}) {
  const [sending, setSending] = React.useState(false);

  async function onForward() {
    setSending(true);
    try {
      await forwardNurseAdmCase(id);
      toast.success({
        title: "Case forwarded",
        description: `${student}'s case moves to the ADM coordinator for the parent meeting.`,
      });
      onChanged();
    } catch (err) {
      toast.error({
        title: "Forward failed",
        description: apiErrorMessage(err, "Could not forward this case."),
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <Button
      variant="default"
      size="xs"
      disabled={sending}
      onClick={() => void onForward()}
    >
      {sending ? "Forwarding…" : "Endorse & forward"}
    </Button>
  );
}

export function NurseAlertsFeed({
  alerts,
  onChanged,
}: {
  alerts: NurseAlertItem[];
  onChanged: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const [severity, setSeverity] = React.useState<"" | NurseAlertSeverity>("");
  const [page, setPage] = React.useState(1);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return alerts.filter((a) => {
      if (severity !== "" && a.severity !== severity) return false;
      if (
        q !== "" &&
        !`${a.title} ${a.detail} ${a.row.student} ${a.row.lrn}`.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [alerts, query, severity]);

  const clearFilters = React.useCallback(() => {
    setQuery("");
    setSeverity("");
    setPage(1);
  }, []);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);
  const severityLabel = severity === "" ? "All severities" : NURSE_SEVERITY_LABELS[severity];

  return (
    <Card className={styles.panel}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle className={styles.sectionTitle}>Alert queue</CardTitle>
          <CardDescription className={styles.sectionDesc}>
            Most pressing first — {total} alert{total === 1 ? "" : "s"} on your desk.
          </CardDescription>
        </div>
        {alerts.length > 0 && (
          <CardAction className={styles.headerActions}>
            <div className={styles.searchWrap}>
              <Search className={styles.searchIcon} aria-hidden />
              <Input
                className={styles.search}
                placeholder="Search alerts…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                aria-label="Search alerts"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Filter alerts by severity, currently showing: ${severityLabel}`}
                  className={`${styles.filterBtn} ${severity !== "" ? styles.filterActive : ""}`}
                >
                  {severity === "" ? "Severity" : severityLabel}
                  {severity !== "" && <span className={styles.filterDot} aria-hidden />}
                  <ChevronDown aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={styles.filterMenu}>
                <DropdownMenuCheckboxItem
                  checked={severity === ""}
                  onCheckedChange={() => {
                    setSeverity("");
                    setPage(1);
                  }}
                >
                  All severities
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {SEVERITY_ORDER.map((s) => (
                  <DropdownMenuCheckboxItem
                    key={s}
                    checked={severity === s}
                    onCheckedChange={() => {
                      setSeverity(s);
                      setPage(1);
                    }}
                  >
                    {NURSE_SEVERITY_LABELS[s]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {(query.trim() !== "" || severity !== "") && (
              <Button variant="ghost" size="sm" className={styles.clearBtn} onClick={clearFilters}>
                <X aria-hidden />
                Show all
              </Button>
            )}
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className={styles.empty}>No alerts — nothing needs your attention right now.</p>
        ) : filtered.length === 0 ? (
          <p className={styles.empty}>No alerts match your search and filters.</p>
        ) : (
          <div className={styles.grid}>
            {pageRows.map((alert) => (
              <article key={alert.key} className={styles.alertCard}>
                <div className={styles.cardHead}>
                  <div>
                    <p className={styles.student}>{alert.row.student}</p>
                    <p className={styles.sub}>
                      <span className={styles.mono}>{alert.row.lrn}</span> · {alert.row.grade}
                    </p>
                  </div>
                  <div className={styles.headBadges}>
                    <Badge variant={severityBadge(alert.severity)}>
                      {NURSE_SEVERITY_LABELS[alert.severity]}
                    </Badge>
                    {alert.row.type === "ADM" ? (
                      <Badge variant="secondary">ADM</Badge>
                    ) : (
                      <Badge variant="outline">Clinic</Badge>
                    )}
                  </div>
                </div>
                <ul className={styles.chips}>
                  <li>
                    <Badge variant="outline">{alert.row.category}</Badge>
                  </li>
                </ul>
                <ul className={styles.triggerList}>
                  <li className={styles.triggerItem}>{alert.title}</li>
                  <li className={styles.triggerItem}>{alert.waiting}</li>
                  <li className={styles.triggerItem}>{alert.detail}</li>
                </ul>
                <div className={styles.details}>
                  <DetailRow
                    label="Status"
                    value={NURSE_STATUS_LABELS[alert.row.status] ?? alert.row.status}
                  />
                  <DetailRow label="Referred" value={alert.row.date} />
                </div>
                <div className={styles.actions}>
                  {alert.row.type === "ADM" &&
                    alert.row.status === "pending" &&
                    alert.row.referralReady && (
                      <ForwardAdmButton
                        id={alert.row.id}
                        student={alert.row.student}
                        onChanged={onChanged}
                      />
                    )}
                  {alert.row.type === "ADM" && alert.row.status === "pending" && (
                    <NurseAdmReviewDialog row={alert.row} onChanged={onChanged} />
                  )}
                  <NurseQueueRowActions row={alert.row} onChanged={onChanged} />
                </div>
              </article>
            ))}
          </div>
        )}
        <div className={styles.pager}>
          <p className={styles.range}>
            Showing {start}–{end} of {total}
          </p>
          <div className={styles.pagerButtons}>
            <Button
              size="xs"
              variant="outline"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className={styles.pageLabel} aria-live="polite">
              Page {safePage} of {totalPages}
            </span>
            <Button
              size="xs"
              variant="outline"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
