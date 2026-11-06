"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronLeft,
  Download,
  ExternalLink,
  FileSearch,
  FileText,
  GitBranch,
  GraduationCap,
  History,
  Loader2,
  SlidersHorizontal,
  Table2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { useDock } from "@/components/dock/dock-store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import ThoughtLine from "@/components/ui/thought-line/ThoughtLine";
import { StatusBadge, displaySubjectName, formatRelativeTime } from "@/components/registry/sf10/shared";
import {
  GRADE_LABEL,
  SF10_SOURCE_LABEL,
  type Sf10DeficiencyEntry,
} from "@/services/registry/sf10.types";
import {
  fetchSf10Detail,
  releaseSf10,
  validateSf10,
  verifySf10,
} from "@/services/registry/sf10.service";
import { markSelfNotified as markRegistrarNotified } from "@/lib/realtime/registrarChannel";
import { markSelfNotified as markRecordKeeperNotified } from "@/lib/realtime/recordKeeperChannel";
import styles from "./sf10.module.css";

const GRADE_ORDER = ["G7", "G8", "G9", "G10", "G11", "G12"];

function fileExtOf(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  } catch {
    return url.split("?")[0].split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  }
}

function isSpreadsheetUrl(url: string, mime?: string | null): boolean {
  return (
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel" ||
    fileExtOf(url) === "xlsx" ||
    fileExtOf(url) === "xls"
  );
}

function QuarterCells({ quarters, count = 4 }: { quarters?: Array<number | null> | null; count?: number }) {
  const cells = [quarters?.[0] ?? null, quarters?.[1] ?? null, quarters?.[2] ?? null, quarters?.[3] ?? null].slice(0, count);
  return (
    <>
      {cells.map((q, i) => (
        <TableCell key={i} className="text-right font-mono text-muted-foreground tabular-nums">
          {q ?? "—"}
        </TableCell>
      ))}
    </>
  );
}

function finalOf(entry: { rating?: number | null; quarters?: Array<number | null> | null }): string | number {
  if (typeof entry.rating === "number") return entry.rating;
  const qs = (entry.quarters ?? []).filter((q): q is number => typeof q === "number");
  return qs.length > 0 ? qs[qs.length - 1] : "—";
}

/** Pill-tab styling for the grade switcher — amber when active, muted outline otherwise. */
function gradeTabClass(active: boolean): string {
  return `inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium transition-colors ${
    active
      ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400"
      : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
  }`;
}

/** Icon toggle for the trail / version boards — same 9×9 gutter-icon look as
 * the record-keeper overview rail (amber while its board is open). */
function MetaIconButton({
  label,
  expanded,
  onToggle,
  children,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-haspopup="dialog"
          aria-label={expanded ? `Hide ${label}` : `Show ${label}`}
          className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border transition-colors ${
            expanded
              ? "border-amber-500/60 bg-amber-500/10"
              : "border-border bg-card hover:border-amber-500/60 hover:bg-amber-500/10"
          }`}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={10}>
        <span className="font-medium">{label}</span>
      </TooltipContent>
    </Tooltip>
  );
}

// Flyout panel — same look + motion as the record-keeper overview KPI rail:
// solid surface, shadow + ring, anchored beside its icon.
const META_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-80";

/** Small label/value cell — the record trail's 2×2 info cards. */
function MetaCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-2 py-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium">{value}</p>
    </div>
  );
}

/** Trail stamp row — shows who verified/validated, plus the one-click
 * button that records the stamp (disabled once stamped or released). */
function MetaStampRow({
  label,
  verb,
  doneVerb,
  name,
  at,
  busy,
  disabled,
  title,
  onAction,
}: {
  label: string;
  verb: string;
  doneVerb: string;
  name: string | null;
  at: string | null;
  busy: boolean;
  disabled: boolean;
  title?: string;
  onAction: () => void;
}) {
  const done = at !== null;
  return (
    <div className="rounded-md border border-border px-2 py-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {name ? (
            <Badge
              variant="amber"
              className="max-w-full rounded-md font-normal"
              title={at ? `${name} · ${formatRelativeTime(at)}` : name}
            >
              <span className="min-w-0 truncate">
                {name}
                {at ? ` · ${formatRelativeTime(at)}` : ""}
              </span>
            </Badge>
          ) : (
            <p className="text-sm">—</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className={`h-6 shrink-0 gap-1 px-2 text-xs ${
            done ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : ""
          }`}
          disabled={disabled}
          title={title}
          onClick={onAction}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : done ? (
            <CheckCircle2 className="size-3.5" aria-hidden />
          ) : null}
          {done ? doneVerb : verb}
        </Button>
      </div>
    </div>
  );
}

/** Trail / version icon toggles — sit in the chrome header (overlay dialog
 * title row, page header) right side. Each icon opens its kanban board as a
 * flyout beside it, same interaction as the overview KPI rail. */
export function Sf10MetaToggles({ desk, id }: { desk: "registrar" | "record-keeper"; id: string }) {
  const [openKey, setOpenKey] = React.useState<"trail" | "versions" | null>(null);
  const railRef = React.useRef<HTMLDivElement>(null);
  // Shares the report body's query key — the flyouts render from cache.
  const detailQuery = useSf10Detail(desk, id);
  const record = detailQuery.data?.record ?? null;
  const versions = detailQuery.data?.versions ?? [];
  const queryClient = useQueryClient();
  const dock = useDock();
  const [acting, setActing] = React.useState<"verify" | "validate" | null>(null);
  const markNotified = desk === "registrar" ? markRegistrarNotified : markRecordKeeperNotified;

  React.useEffect(() => {
    if (!openKey) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      // Portaled tooltips live outside the rail — interacting with them
      // must not dismiss the open panel.
      if (target?.closest?.('[data-slot="tooltip-content"]')) return;
      if (railRef.current && !railRef.current.contains(e.target as Node)) {
        setOpenKey(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openKey]);

  // One-click verify / validate stamps — the trail buttons call these and
  // every board reading this record refreshes after.
  const stamp = async (kind: "verify" | "validate") => {
    if (!record || acting) return;
    setActing(kind);
    let taskId: string | null = null;
    try {
      taskId = dock.startTask({
        kind: "generic",
        title: kind === "verify" ? "Verifying SF10 record" : "Validating SF10 record",
        description: record.fullName,
      });
    } catch {
      taskId = null;
    }
    try {
      if (kind === "verify") await verifySf10(record.id);
      else await validateSf10(record.id);
      // The validate stamp files a self-notification — suppress its toast.
      if (kind === "validate") markNotified(record.id);
      if (taskId) {
        dock.completeTask(
          taskId,
          kind === "verify" ? "Record verified." : "Record validated.",
        );
      }
      toast.success({
        title: kind === "verify" ? "Verified" : "Validated",
        description: `${record.fullName} marked as ${kind === "verify" ? "verified" : "validated"}.`,
      });
      void queryClient.invalidateQueries({ queryKey: [`${desk}-sf10`] });
      void queryClient.invalidateQueries({ queryKey: [`${desk}-overview`] });
      void queryClient.invalidateQueries({ queryKey: [`${desk}-notifications`] });
    } catch {
      if (taskId) dock.failTask(taskId, "Nothing was changed.");
      toast.error({
        title: kind === "verify" ? "Verify failed" : "Validate failed",
        description: "Nothing was changed.",
      });
    } finally {
      setActing(null);
    }
  };

  const toggle = (key: "trail" | "versions") =>
    setOpenKey((prev) => (prev === key ? null : key));
  const panelClass = (open: boolean) =>
    `${META_PANEL} ${styles.metaMenu} ${open ? styles.metaMenuOpen : styles.metaMenuClosed}`;

  return (
    <TooltipProvider delayDuration={100}>
      <div ref={railRef} className="flex items-center gap-2">
        <div className="relative">
          <MetaIconButton
            label="Record trail"
            expanded={openKey === "trail"}
            onToggle={() => toggle("trail")}
          >
            <span className="text-amber-500" aria-hidden>
              <History size={16} />
            </span>
          </MetaIconButton>
          <div
            role="dialog"
            aria-label="Record trail"
            aria-hidden={openKey === "trail" ? undefined : true}
            className={panelClass(openKey === "trail")}
          >
            <KanbanBoard
              title="Record trail"
              icon={<History size={14} className="text-amber-500" aria-hidden />}
              ariaLabel="Record trail"
              className="border-0"
            >
              {record ? (
                <div className="space-y-2 px-1 pb-1">
                  <div className="grid grid-cols-2 gap-2">
                    <MetaCell label="Uploaded" value={formatRelativeTime(record.uploadedAt)} />
                    <MetaCell label="Version" value={`v${record.currentVersion}`} />
                    <MetaCell label="Released" value={formatRelativeTime(record.releasedAt)} />
                    <MetaCell label="Updated" value={formatRelativeTime(record.updatedAt)} />
                  </div>
                  <MetaStampRow
                    label="Verified by"
                    verb="Verify"
                    doneVerb="Verified"
                    name={record.verifiedByName ?? null}
                    at={record.verifiedAt}
                    busy={acting === "verify"}
                    disabled={record.status === "released" || record.verifiedAt !== null || acting !== null}
                    title={
                      record.status === "released"
                        ? "This record is released & archived — verification is closed"
                        : undefined
                    }
                    onAction={() => stamp("verify")}
                  />
                  <MetaStampRow
                    label="Validated by"
                    verb="Validate"
                    doneVerb="Validated"
                    name={record.validatedByName ?? null}
                    at={record.validatedAt}
                    busy={acting === "validate"}
                    disabled={record.status === "released" || record.validatedAt !== null || acting !== null}
                    title={
                      record.status === "released"
                        ? "This record is released & archived — validation is closed"
                        : undefined
                    }
                    onAction={() => stamp("validate")}
                  />
                </div>
              ) : (
                <p className="px-1 pb-1 text-xs text-muted-foreground">Loading…</p>
              )}
            </KanbanBoard>
          </div>
        </div>

        <div className="relative">
          <MetaIconButton
            label="Version history"
            expanded={openKey === "versions"}
            onToggle={() => toggle("versions")}
          >
            <span className="text-amber-500" aria-hidden>
              <GitBranch size={16} />
            </span>
          </MetaIconButton>
          <div
            role="dialog"
            aria-label="Version history"
            aria-hidden={openKey === "versions" ? undefined : true}
            className={panelClass(openKey === "versions")}
          >
            <KanbanBoard
              title="Version history"
              icon={<GitBranch size={14} className="text-amber-500" aria-hidden />}
              ariaLabel="Version history"
              className="border-0"
            >
              {detailQuery.isPending ? (
                <p className="px-1 pb-1 text-xs text-muted-foreground">Loading…</p>
              ) : versions.length === 0 ? (
                <p className="px-1 pb-1 text-sm text-muted-foreground">No versions yet.</p>
              ) : (
                <div className={`${styles.timeline} px-1 pb-1`}>
                  {versions.map((v) => (
                    <div key={v.versionNumber} className={styles.timelineRow}>
                      <span>
                        <span className={styles.name}>v{v.versionNumber}</span>{" "}
                        <span className={styles.timelineReason}>— {v.changeReason}</span>
                      </span>
                      <span className={styles.muted}>{formatRelativeTime(v.changedAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </KanbanBoard>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

/** Shared detail fetch — the report body and the header meta toggles read
 * the same query key, so the flyouts never trigger a second request. */
function useSf10Detail(desk: "registrar" | "record-keeper", id: string) {
  return useQuery({
    queryKey: [`${desk}-sf10`, "detail", id],
    queryFn: ({ signal }) => fetchSf10Detail(id, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchInterval: (query) =>
      query.state.data?.map.ocrStatus === "processing" ? 4000 : false,
  });
}

/**
 * Record report body — the one source of truth for the SF10 detail, shared
 * by the dedicated route (deep-link fallback) and the board overlay. Layout
 * is the kanban board language (KanbanBoard shells) instead of glow cards.
 */
export function Sf10DetailContent({ desk, id }: { desk: "registrar" | "record-keeper"; id: string }) {
  const queryClient = useQueryClient();
  const dock = useDock();
  const [acting, setActing] = React.useState<"release" | null>(null);
  const [downloading, setDownloading] = React.useState(false);
  // Prefetched same-origin URL for view-only opening, tagged with the file
  // it was fetched for so stale prefetches are ignored (never a blank tab).
  const [view, setView] = React.useState<{ forUrl: string | null; objectUrl: string | null }>({
    forUrl: null,
    objectUrl: null,
  });
  // Grade tab for the report board — one grade table at a time.
  const [gradeTab, setGradeTab] = React.useState<string | null>(null);

  const detailQuery = useSf10Detail(desk, id);

  const data = detailQuery.data;
  const record = data?.record ?? null;
  const map = data?.map ?? null;

  const markNotified = desk === "registrar" ? markRegistrarNotified : markRecordKeeperNotified;
  // Quarter column labels — same Q1..Q4 set on both desks (the semester tabs
  // split them: Q1/Q2 in 1st Sem, Q3/Q4 in 2nd Sem).
  const quarterLabels = ["Q1", "Q2", "Q3", "Q4"];

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: [`${desk}-sf10`] });
    void queryClient.invalidateQueries({ queryKey: [`${desk}-overview`] });
    void queryClient.invalidateQueries({ queryKey: [`${desk}-notifications`] });
  };

  const handleRelease = async () => {
    if (!record) return;
    setActing("release");
    let taskId: string | null = null;
    try {
      taskId = dock.startTask({
        kind: "generic",
        title: "Releasing SF10 record",
        description: record.fullName,
      });
    } catch {
      taskId = null;
    }
    try {
      await releaseSf10(record.id);
      markNotified(record.id);
      if (taskId) dock.completeTask(taskId, "Released & archived.");
      toast.success({ title: "Released", description: `${record.fullName} released & archived.` });
      refresh();
    } catch {
      if (taskId) dock.failTask(taskId, "Nothing was changed.");
      toast.error({ title: "Release failed", description: "Nothing was changed." });
    } finally {
      setActing(null);
    }
  };

  const handleDownload = async () => {
    if (!record?.uploadedFileUrl) return;
    setDownloading(true);
    try {
      const res = await fetch(record.uploadedFileUrl);
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const pathname = (() => {
        try {
          return new URL(record.uploadedFileUrl).pathname;
        } catch {
          return record.uploadedFileUrl.split("?")[0];
        }
      })();
      const urlExt = pathname.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
      const typeExt =
        blob.type === "application/pdf"
          ? "pdf"
          : blob.type === "image/jpeg"
            ? "jpg"
            : blob.type === "image/png"
              ? "png"
              : blob.type === "image/webp"
                ? "webp"
                : null;
      const ext = urlExt && urlExt.length <= 5 ? urlExt : (typeExt ?? "pdf");
      const safeName = record.fullName.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "") || "SF10";
      const filename = `SF10_${safeName}_${record.lrn}.${ext}`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Fallback: open in a new tab so the user can still save it manually.
      window.open(record.uploadedFileUrl, "_blank", "noopener,noreferrer");
      toast.error({ title: "Download failed", description: "Opened the file in a new tab instead." });
    } finally {
      setDownloading(false);
    }
  };

  // View-only: opens the file in a new tab rendered inline (never saved).
  // Spreadsheets can't render natively, so they go through the Office
  // viewer; PDFs/images open via a prefetched same-origin blob URL so the
  // browser displays instead of downloading (avoids storage
  // Content-Disposition forcing a download). Falls back to the raw URL
  // when the prefetch hasn't finished or failed.
  const handleViewInNewTab = () => {
    const url = record?.uploadedFileUrl;
    if (!url) return;
    const cached = view.forUrl === url && !isSpreadsheetUrl(url) ? view.objectUrl : null;
    const target = isSpreadsheetUrl(url)
      ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`
      : (cached ?? url);
    const win = window.open(target, "_blank", "noopener,noreferrer");
    if (!win) {
      toast.error({ title: "Popup blocked", description: "Allow popups for this site, then try again." });
    }
  };

  const fileUrl = record?.uploadedFileUrl ?? null;
  React.useEffect(() => {
    if (!fileUrl || isSpreadsheetUrl(fileUrl)) return;
    let cancelled = false;
    void (async () => {
      let objectUrl: string | null = null;
      try {
        const res = await fetch(fileUrl);
        if (!res.ok) return;
        const blob = await res.blob();
        if (cancelled) return;
        if (isSpreadsheetUrl(fileUrl, blob.type)) return;
        objectUrl = URL.createObjectURL(new Blob([blob], { type: blob.type || undefined }));
        setView({ forUrl: fileUrl, objectUrl });
      } catch {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        // Silent: the click handler falls back to the raw URL.
      }
    })();
    return () => {
      cancelled = true;
      setView((prev) => {
        if (prev.forUrl === fileUrl && prev.objectUrl) URL.revokeObjectURL(prev.objectUrl);
        return prev.forUrl === fileUrl ? { forUrl: null, objectUrl: null } : prev;
      });
    };
  }, [fileUrl]);

  const deficiencyGroups = React.useMemo(() => {
    const rows = map?.deficiencies ?? [];
    const order = new Map<string, Sf10DeficiencyEntry[]>();
    for (const d of rows) {
      const list = order.get(d.gradeLevel) ?? [];
      list.push(d);
      order.set(d.gradeLevel, list);
    }
    return [...order.entries()].sort(
      ([a], [b]) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b),
    );
  }, [map]);

  const perGrade = React.useMemo(() => {
    const rows = map?.perGrade ?? [];
    return [...rows].sort(
      (a, b) => GRADE_ORDER.indexOf(a.gradeLevel) - GRADE_ORDER.indexOf(b.gradeLevel),
    );
  }, [map]);

  // SHS records are split into per-semester tabs (Grade 11 — 1st/2nd Sem)
  // instead of a single grade-level tab, so each semester's subjects and
  // quarterly grades are reviewed independently. Both catalog-matched rows
  // and file-only rows are included: the school catalog can absorb SHS
  // subjects by name (e.g. "General Mathematics" → "General Mathematics 11")
  // and dropping those rows would hide them from the report.
  const isShs = desk === "registrar";
  const gradeTabs = React.useMemo(() => {
    if (!isShs) {
      return perGrade.map((r) => ({
        id: r.gradeLevel,
        label: GRADE_LABEL[r.gradeLevel] ?? r.gradeLevel,
        row: r,
        qSlots: undefined as readonly [number, number] | undefined,
      }));
    }
    const SEMS = [
      { id: "S1", label: "1st Sem", idx: 0, a: 0, b: 1 },
      { id: "S2", label: "2nd Sem", idx: 1, a: 2, b: 3 },
    ] as const;
    const inSem = (q: Array<number | null> | null | undefined, a: number, b: number) =>
      (q?.[a] ?? null) !== null || (q?.[b] ?? null) !== null;
    const hasQuarters = (q: Array<number | null> | null | undefined) =>
      Array.isArray(q) && q.some((v) => v !== null && v !== undefined);
    const sliceQ = (q: Array<number | null> | null | undefined, a: number, b: number) =>
      [q?.[a] ?? null, q?.[b] ?? null] as Array<number | null>;
    const out: Array<{
      id: string;
      label: string;
      row: typeof perGrade[number];
      qSlots: readonly [number, number] | undefined;
    }> = [];
    for (const row of perGrade) {
      const gLabel = GRADE_LABEL[row.gradeLevel] ?? row.gradeLevel;
      for (const sem of SEMS) {
        // A row with no quarterly grades at all cannot be placed by semester —
        // keep it visible in the first tab rather than dropping it silently.
        const belongs = (q: Array<number | null> | null | undefined) =>
          hasQuarters(q) ? inSem(q, sem.a, sem.b) : sem.id === "S1";
        const matched = row.matched
          .filter((m) => belongs(m.quarters))
          .map((m) => ({
            ...m,
            name: m.rawName || m.name,
            quarters: sliceQ(m.quarters, sem.a, sem.b),
            // Each semester shows its own final — the merged rating keeps only
            // the latest one for subjects that span both semesters.
            rating: m.semFinals?.[sem.idx] ?? m.rating,
          }));
        const extras = row.extras
          .filter((x) => belongs(x.quarters))
          .map((x) => ({
            ...x,
            quarters: sliceQ(x.quarters, sem.a, sem.b),
            rating: x.semFinals?.[sem.idx] ?? x.rating,
          }));
        if (matched.length + extras.length === 0) continue;
        out.push({
          id: `${row.gradeLevel}-${sem.id}`,
          label: `${gLabel} — ${sem.label}`,
          row: { ...row, matched, extras, missing: [], total: 0 },
          qSlots: [sem.a, sem.b],
        });
      }
    }
    return out;
  }, [perGrade, isShs]);

  // Blank rows (no subject name) carry no information — drop them so the
  // Add-on section never renders an empty list.
  const visibleAddons = React.useMemo(
    () => (map?.addons ?? []).filter((a) => (a.rawName ?? "").trim() !== ""),
    [map],
  );

  const totalMissing = deficiencyGroups.reduce((n, [, items]) => n + items.length, 0);
  // The school catalog is only the basis for not-taken: grade tables always
  // show the file's own rows, even when no catalog subjects are set.
  const hasCatalog = (map?.schoolSubjectCount ?? 0) > 0 || perGrade.some((r) => r.total > 0);
  // Grade pill tabs — grades in order, add-ons as the last tab when present.
  // Falls back to the first tab if the stored pick is gone (record switched,
  // or OCR finished and re-shaped the grades).
  const gradeTabIds = [
    ...gradeTabs.map((t) => t.id),
    ...(visibleAddons.length > 0 ? ["addons"] : []),
  ];
  const activeGradeTab = gradeTab && gradeTabIds.includes(gradeTab) ? gradeTab : (gradeTabIds[0] ?? null);
  const activeTabMeta = gradeTabs.find((t) => t.id === activeGradeTab) ?? null;
  const activeGradeRow = activeTabMeta?.row ?? null;
  // Semester tabs show only their own two quarter columns (Q1/Q2 or Q3/Q4);
  // grade-level tabs keep all four.
  const viewQSlots = activeTabMeta?.qSlots ?? null;
  const viewQLabels = viewQSlots ? viewQSlots.map((i) => quarterLabels[i]) : quarterLabels;
  // Top-right count for the report board — the active grade is already the
  // tab label, so only the ratio rides in the header ("7/8 taken").
  const activeTabCount = activeGradeRow
    ? activeGradeRow.total > 0
      ? `${activeGradeRow.matched.length}/${activeGradeRow.total} taken`
      : `${activeGradeRow.matched.length + activeGradeRow.extras.length} on record`
    : visibleAddons.length > 0
      ? `${visibleAddons.length} add-on${visibleAddons.length === 1 ? "" : "s"}`
      : undefined;

  if (detailQuery.isPending) {
    return <DetailSkeleton />;
  }

  if (detailQuery.isError || !record || !map) {
    return (
      <KanbanBoard
        title="Record not found"
        icon={<GraduationCap size={14} className="text-muted-foreground" aria-hidden />}
        ariaLabel="Record not found"
        description={
          detailQuery.isError
            ? "Could not load this SF10 report."
            : "No SF10 record exists for this learner."
        }
      >
        <div className="flex justify-center px-0.5 pb-0.5">
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => detailQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      </KanbanBoard>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="grid items-start gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-4 lg:col-span-2 lg:space-y-6">
          {/* Learner — top of the main column, same width as the report below. */}
          <KanbanBoard
            title="Learner"
            icon={<UserRound size={14} className="text-amber-500" aria-hidden />}
            ariaLabel="Learner"
          >
            <div className="px-0.5 pb-0.5">
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold">{record.fullName}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="rounded-md font-normal">
                      {record.lrn}
                    </Badge>
                    <StatusBadge status={record.status} className="rounded-md" />
                    <Badge variant="amber" className="rounded-md font-normal">
                      {SF10_SOURCE_LABEL[record.source]}
                    </Badge>
                  </div>
                </div>
                <StudentMascot name={record.fullName} seed={record.id} size={56} />
              </div>
            </div>
          </KanbanBoard>

          {/* Grade-by-grade report — one grade table at a time via pill tabs;
              add-ons ride along as their own tab when the file has them. */}
          {perGrade.length > 0 || visibleAddons.length > 0 ? (
            <KanbanBoard
              title="Grade-by-grade report"
              icon={<Table2 size={14} className="text-amber-500" aria-hidden />}
              ariaLabel="Grade-by-grade report"
              count={activeTabCount}
              description={
                hasCatalog
                  ? `Each record year checked against that grade's catalog — ${map.ocrSubjectCount} subjects read from the file.`
                  : `Subjects read straight from the file — ${map.ocrSubjectCount} found. Add school subjects to check not-taken.`
              }
            >
              <div className="flex flex-col gap-3 px-0.5 pb-0.5">
                <div
                  role="tablist"
                  aria-label="Grade levels and add-ons"
                  className="flex flex-wrap items-center gap-1.5"
                >
                  {gradeTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={tab.id === activeGradeTab}
                      onClick={() => setGradeTab(tab.id)}
                      className={gradeTabClass(tab.id === activeGradeTab)}
                    >
                      {tab.label}
                    </button>
                  ))}
                  {visibleAddons.length > 0 ? (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeGradeTab === "addons"}
                      onClick={() => setGradeTab("addons")}
                      className={gradeTabClass(activeGradeTab === "addons")}
                    >
                      Add-ons
                    </button>
                  ) : null}
                </div>

                {activeGradeRow ? (
                  <div role="tabpanel">
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <Table className={styles.reportTable}>
                        <colgroup>
                          <col />
                          {viewQLabels.map((label) => (
                            <col key={label} style={{ width: "3.25rem" }} />
                          ))}
                          <col style={{ width: "4rem" }} />
                        </colgroup>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Learning area</TableHead>
                            {viewQLabels.map((label) => (
                              <TableHead key={label} className="text-right">
                                {label}
                              </TableHead>
                            ))}
                            <TableHead className="text-right">Final</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[
                            ...activeGradeRow.matched.map((m) => ({
                              kind: "matched" as const,
                              order: m.order ?? Number.MAX_SAFE_INTEGER,
                              item: m,
                            })),
                            ...activeGradeRow.extras.map((x) => ({
                              kind: "extra" as const,
                              order: x.order ?? Number.MAX_SAFE_INTEGER,
                              item: x,
                            })),
                          ]
                            .sort((a, b) => a.order - b.order)
                            .map((r, ri) =>
                              r.kind === "matched" ? (
                                <TableRow key={r.item.code}>
                                  <TableCell className="font-medium text-foreground">{displaySubjectName(r.item.name)}</TableCell>
                                  <QuarterCells quarters={r.item.quarters} count={viewQLabels.length} />
                                  <TableCell className="text-right font-mono tabular-nums">
                                    {finalOf(r.item)}
                                  </TableCell>
                                </TableRow>
                              ) : (
                                <TableRow key={`extra-${r.item.norm}-${r.item.rawName}-${ri}`}>
                                  <TableCell className="font-medium text-foreground">
                                    {r.item.rawName}
                                  </TableCell>
                                  <QuarterCells quarters={r.item.quarters} count={viewQLabels.length} />
                                  <TableCell className="text-right font-mono tabular-nums">
                                    {r.item.rating ?? "—"}
                                  </TableCell>
                                </TableRow>
                              ),
                            )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : null}

                {activeGradeTab === "addons" && visibleAddons.length > 0 ? (
                  <div role="tabpanel">
                    <p className="text-sm font-semibold text-foreground">Add-on subjects</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Read from the file with no grade level indicated — kept on record as-is, outside the grade tables.
                    </p>
                    <div className="mt-2 overflow-x-auto rounded-lg border border-border">
                      <Table className={styles.reportTable}>
                        <colgroup>
                          <col />
                          <col style={{ width: "3.25rem" }} />
                          <col style={{ width: "3.25rem" }} />
                          <col style={{ width: "3.25rem" }} />
                          <col style={{ width: "3.25rem" }} />
                          <col style={{ width: "4rem" }} />
                          <col style={{ width: "8.5rem" }} />
                        </colgroup>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Learning area</TableHead>
                            <TableHead className="text-right">{quarterLabels[0]}</TableHead>
                            <TableHead className="text-right">{quarterLabels[1]}</TableHead>
                            <TableHead className="text-right">{quarterLabels[2]}</TableHead>
                            <TableHead className="text-right">{quarterLabels[3]}</TableHead>
                            <TableHead className="text-right">Final</TableHead>
                            <TableHead>Remarks</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleAddons.map((a, ai) => (
                            <TableRow key={`addon-${a.norm}-${a.rawName}-${ai}`}>
                              <TableCell>
                                <span className="font-medium text-foreground">{a.rawName}</span>
                                <Badge variant="outline" className="ml-2 font-normal">
                                  Add-on
                                </Badge>
                              </TableCell>
                              <QuarterCells quarters={a.quarters} />
                              <TableCell className="text-right font-mono tabular-nums">
                                {a.rating ?? "—"}
                              </TableCell>
                              <TableCell>
                                {a.remarks ? (
                                  <Badge variant="outline" className="font-normal">
                                    {a.remarks}
                                  </Badge>
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : null}
              </div>
            </KanbanBoard>
          ) : null}

          {map.needsReview ? (
            <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Some years or names could not be read confidently — compare with the file before validating.
            </p>
          ) : null}

          {map.sf10Only.length > 0 && perGrade.length === 0 ? (
            <KanbanBoard
              title="In the file only"
              icon={<FileSearch size={14} className="text-amber-500" aria-hidden />}
              ariaLabel="In the file only"
              description="Subjects found in the file that aren't in the school catalog."
            >
              <div className="flex flex-wrap gap-1.5 px-0.5 pb-0.5">
                {map.sf10Only.map((s, i) => (
                  <Badge key={`${s.norm}-${i}`} variant="outline" className="font-normal">
                    {s.rawName}
                  </Badge>
                ))}
              </div>
            </KanbanBoard>
          ) : null}
        </div>

        <div className="space-y-4 lg:space-y-6">
          {/* Filing / status — small board pinned to the right column. */}
          {map.ocrStatus === "processing" ? (
            <FilingProgress
              fullName={record.fullName}
              subjectCount={map.ocrSubjectCount}
              gradesDetected={map.coverage.gradesDetected}
            />
          ) : !hasCatalog ? (
            <KanbanBoard
              title="Subjects on record"
              icon={<FileText size={14} className="text-amber-500" aria-hidden />}
              ariaLabel="Subjects on record"
              count={map.ocrSubjectCount}
              description="Read straight from the file — no school subjects set yet, so not-taken can't be checked."
            >
              {null}
            </KanbanBoard>
          ) : totalMissing > 0 ? (
            <KanbanBoard
              title="Subjects not taken"
              icon={<AlertTriangle size={14} className="text-destructive" aria-hidden />}
              ariaLabel="Subjects not taken"
              count={totalMissing}
              description="Compared grade by grade against the school catalog — blank or zero in the file means not taken."
              className="bg-destructive/[0.04]"
              style={{ borderColor: "color-mix(in oklch, var(--destructive), transparent 60%)" }}
            >
              <div className="grid grid-cols-[auto_1fr] items-start gap-x-2 gap-y-1.5 px-0.5 pb-0.5">
                {deficiencyGroups.map(([grade, items]) => (
                  <React.Fragment key={grade}>
                    <Badge variant="amber" className="rounded-md font-medium">
                      {GRADE_LABEL[grade] ?? grade}
                    </Badge>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((d) => (
                        <Badge
                          key={d.code}
                          variant="red"
                          className="rounded-md font-normal"
                          title={`${d.category} · blank or 0 rating in the file`}
                        >
                          {displaySubjectName(d.name)}
                        </Badge>
                      ))}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </KanbanBoard>
          ) : (
            <KanbanBoard
              title="All subjects taken"
              icon={<CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" aria-hidden />}
              ariaLabel="All subjects taken"
              description="Every cataloged subject for the covered years appears in this record."
              className="bg-emerald-500/[0.05]"
              style={{ borderColor: "color-mix(in oklch, var(--color-emerald-500), transparent 70%)" }}
            >
              {null}
            </KanbanBoard>
          )}

          {/* Actions */}
          <KanbanBoard
            title="Record actions"
            icon={<SlidersHorizontal size={14} className="text-amber-500" aria-hidden />}
            ariaLabel="Record actions"
          >
            {/* Buttons sit side by side and wrap on a narrow column; the note
                can't share a row and drops to its own line below. */}
            <div className="flex flex-wrap items-center gap-2 px-0.5 pb-0.5">
              {record.uploadedFileUrl ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleViewInNewTab}
                  >
                    <ExternalLink aria-hidden />
                    View in new tab
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={downloading}
                    onClick={handleDownload}
                  >
                    {downloading ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Download aria-hidden />
                    )}
                    {downloading ? "Downloading…" : "Download"}
                  </Button>
                </>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={record.status !== "attach" || acting !== null}
                onClick={handleRelease}
              >
                {acting === "release" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Archive aria-hidden />
                )}
                {acting === "release" ? "Releasing…" : "Release & archive"}
              </Button>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Uploads are stored as-is — no approval needed. Releasing archives the record.
              </p>
            </div>
          </KanbanBoard>

        </div>
      </div>
    </div>
  );
}

/**
 * Dedicated-route wrapper (`/{desk}/sf10/{id}`) — kept as the deep-link
 * fallback; in-app clicks open the overlay instead.
 */
export function Sf10DetailView({ desk }: { desk: "registrar" | "record-keeper" }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = React.useMemo(() => decodeURIComponent(params.id), [params.id]);

  return (
    <section className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          SF10 Record Report
        </span>
        <div className="flex items-center gap-2">
          <Sf10MetaToggles desk={desk} id={id} />
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => router.push(`/${desk}/sf10`)}
          >
            <ChevronLeft className="mr-1" aria-hidden />
            Back to records
          </Button>
        </div>
      </div>
      <Sf10DetailContent desk={desk} id={id} />
    </section>
  );
}

function FilingProgress({
  fullName,
  subjectCount,
  gradesDetected,
}: {
  fullName: string;
  subjectCount: number;
  gradesDetected: string[];
}) {
  const grades = gradesDetected.map((g) => GRADE_LABEL[g] ?? g);
  // Earlier steps tick, the last one pulses — same filing feel as Bama.
  const steps = [
    "File received",
    ...(subjectCount > 0
      ? [`Found ${subjectCount} subject${subjectCount === 1 ? "" : "s"}`]
      : ["Reading subjects and grades"]),
    ...(grades.length > 0 ? [`Grades detected: ${grades.join(", ")}`] : []),
  ];
  return (
    <KanbanBoard
      title="Filing the record"
      icon={<Loader2 size={14} className="animate-spin text-amber-500" aria-hidden />}
      ariaLabel="Filing progress"
      description="Reading the file — subjects and grades are detected, then filed automatically."
    >
      <div className="flex flex-col items-start gap-2 px-0.5 pb-0.5" aria-busy="true">
        <ThoughtLine
          working
          steps={steps}
          label={`Filing ${fullName}'s record…`}
          fontSize={14}
          collapsible
          collapseOnSettle
          showTimer
        />
        <p className="text-xs text-muted-foreground">
          This refreshes on its own — no need to reload.
        </p>
      </div>
    </KanbanBoard>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
      <div className="space-y-4 lg:col-span-2 lg:space-y-6">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
      <div className="space-y-4 lg:space-y-6">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}
