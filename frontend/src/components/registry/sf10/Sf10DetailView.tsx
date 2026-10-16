"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  BadgeCheck,
  CheckCircle2,
  ChevronLeft,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "@/components/ui/sonner";
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
} from "@/services/registry/sf10.service";
import { markSelfNotified as markRegistrarNotified } from "@/lib/realtime/registrarChannel";
import { markSelfNotified as markRecordKeeperNotified } from "@/lib/realtime/recordKeeperChannel";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
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

function QuarterCells({ quarters }: { quarters?: Array<number | null> | null }) {
  const cells = [quarters?.[0] ?? null, quarters?.[1] ?? null, quarters?.[2] ?? null, quarters?.[3] ?? null];
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

export function Sf10DetailView({ desk }: { desk: "registrar" | "record-keeper" }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = React.useMemo(() => decodeURIComponent(params.id), [params.id]);
  const [acting, setActing] = React.useState<"release" | null>(null);
  const [downloading, setDownloading] = React.useState(false);
  // Prefetched same-origin URL for view-only opening, tagged with the file
  // it was fetched for so stale prefetches are ignored (never a blank tab).
  const [view, setView] = React.useState<{ forUrl: string | null; objectUrl: string | null }>({
    forUrl: null,
    objectUrl: null,
  });

  const detailQuery = useQuery({
    queryKey: [`${desk}-sf10`, "detail", id],
    queryFn: ({ signal }) => fetchSf10Detail(id, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchInterval: (query) =>
      query.state.data?.map.ocrStatus === "processing" ? 4000 : false,
  });

  const data = detailQuery.data;
  const record = data?.record ?? null;
  const map = data?.map ?? null;
  const versions = data?.versions ?? [];

  const markNotified = desk === "registrar" ? markRegistrarNotified : markRecordKeeperNotified;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: [`${desk}-sf10`] });
    void queryClient.invalidateQueries({ queryKey: [`${desk}-overview`] });
    void queryClient.invalidateQueries({ queryKey: [`${desk}-notifications`] });
  };

  const handleRelease = async () => {
    if (!record) return;
    setActing("release");
    try {
      await releaseSf10(record.id);
      markNotified(record.id);
      toast.success({ title: "Released", description: `${record.fullName} released & archived.` });
      refresh();
    } catch {
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
  const initial = record?.fullName?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <section className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          SF10 Record Report
        </span>
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

      {detailQuery.isPending ? (
        <DetailSkeleton />
      ) : detailQuery.isError || !record || !map ? (
        <section className={assign.card} aria-label="Record not found">
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex flex-col items-center justify-center gap-1.5 py-12 text-center">
            <span className="mb-1.5 inline-flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
              <GraduationCap className="size-5" />
            </span>
            <p className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
              Record not found
            </p>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              {detailQuery.isError
                ? "Could not load this SF10 report."
                : "No SF10 record exists for this learner."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => detailQuery.refetch()}
            >
              Try again
            </Button>
          </div>
        </section>
      ) : (
        <>
          {/* Filing progress: chat-style steps while the file is being read. */}
          {map.ocrStatus === "processing" ? (
            <FilingProgress
              fullName={record.fullName}
              subjectCount={map.ocrSubjectCount}
              gradesDetected={map.coverage.gradesDetected}
            />
          ) : !hasCatalog ? (
            <section
              className={`${assign.card} border-muted`}
              aria-label="Subjects on record"
            >
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex items-center gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
                  <FileText className="size-5" />
                </span>
                <div>
                  <p className="text-lg font-bold tracking-tight text-foreground">
                    {map.ocrSubjectCount} subject{map.ocrSubjectCount === 1 ? "" : "s"} on record
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Read straight from the file — no school subjects set yet, so not-taken can&apos;t be checked.
                  </p>
                </div>
              </div>
            </section>
          ) : totalMissing > 0 ? (
            <section
              className={`${assign.card} border-destructive/40 bg-destructive/[0.04]`}
              aria-label="Subjects not taken"
            >
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive" aria-hidden="true">
                    <AlertTriangle className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-lg font-bold tracking-tight text-foreground">
                      {totalMissing} subject{totalMissing === 1 ? "" : "s"} not taken
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Compared grade by grade against the school catalog — blank or zero in the file means not taken.
                    </p>
                  </div>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {deficiencyGroups.map(([grade, items]) => (
                    <li key={grade} className="flex flex-col gap-1.5 rounded-lg border border-destructive/25 bg-background/60 p-3">
                      <p className="text-sm font-semibold text-foreground">
                        {GRADE_LABEL[grade] ?? grade} — has not taken:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((d) => (
                          <Badge
                            key={d.code}
                            variant="destructive"
                            className="font-normal"
                            title={`${d.category} · blank or 0 rating in the file`}
                          >
                            {displaySubjectName(d.name)}
                          </Badge>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : (
            <section
              className={`${assign.card} border-emerald-500/30 bg-emerald-500/[0.05]`}
              aria-label="All subjects taken"
            >
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex items-center gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" aria-hidden="true">
                  <CheckCircle2 className="size-5" />
                </span>
                <div>
                  <p className="text-lg font-bold tracking-tight text-foreground">
                    All subjects taken
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Every cataloged subject for the covered years appears in this record.
                  </p>
                </div>
              </div>
            </section>
          )}

          <div className="grid items-start gap-4 lg:gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:space-y-6 lg:col-span-2">
              {/* Learner */}
              <section className={assign.card} aria-label="Learner">
                <span className={assign.glowClip} aria-hidden="true">
                  <span className={assign.cardGlow} />
                </span>
                <div className="relative flex items-center gap-4">
                  <Avatar className="size-12">
                    <AvatarFallback>{initial}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold">{record.fullName}</h3>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {GRADE_LABEL[record.gradeLevel] ?? record.gradeLevel} · {record.section}
                    </p>
                    <p className="font-mono text-sm text-muted-foreground">{record.lrn}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={record.status} />
                      <span className={styles.muted}>{SF10_SOURCE_LABEL[record.source]}</span>
                      <span className={styles.muted}>
                        · Filed by {record.desk === "registrar" ? "Registrar" : "Record keeper"}
                      </span>
                    </div>
                  </div>
                </div>
                {map.learner?.fullName || map.learner?.lrn ? (
                  <div className="relative mt-3 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                    <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <p className="text-muted-foreground">
                      Name on file:{" "}
                      <span className="font-semibold text-foreground">
                        {map.learner.fullName ?? "—"}
                      </span>
                      {map.learner.lrn ? ` · LRN ${map.learner.lrn}` : null}{" "}
                      {map.learner.lrn && map.learner.lrn === record.lrn ? (
                        <Badge variant="default" className="ml-1 font-normal">
                          <BadgeCheck className="mr-1 size-3" aria-hidden />
                          LRN match
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="ml-1 font-normal">
                          check against the file
                        </Badge>
                      )}
                    </p>
                  </div>
                ) : null}
              </section>

              {/* Grade-by-grade report */}
              {perGrade.length > 0 ? (
                <section className={assign.card} aria-labelledby="grade-report">
                  <span className={assign.glowClip} aria-hidden="true">
                    <span className={assign.cardGlow} />
                  </span>
                  <div className="relative">
                    <h2 id="grade-report" className="text-base font-semibold">
                      Grade-by-grade report
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {hasCatalog
                        ? `Each record year checked against that grade's catalog — ${map.ocrSubjectCount} subjects read from the file.`
                        : `Subjects read straight from the file — ${map.ocrSubjectCount} found. Add school subjects to check not-taken.`}
                    </p>
                  </div>
                  <div className="relative mt-3 flex flex-col gap-4">
                    {perGrade.map((row) => (
                      <div key={row.gradeLevel}>
                        <p className="text-sm font-semibold text-foreground">
                          {GRADE_LABEL[row.gradeLevel] ?? row.gradeLevel} ·{" "}
                          {row.total > 0
                            ? `${row.matched.length}/${row.total} taken`
                            : `${row.matched.length + row.extras.length} on record`}
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
                            </colgroup>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Learning area</TableHead>
                                <TableHead className="text-right">Q1</TableHead>
                                <TableHead className="text-right">Q2</TableHead>
                                <TableHead className="text-right">Q3</TableHead>
                                <TableHead className="text-right">Q4</TableHead>
                                <TableHead className="text-right">Final</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {[
                                ...row.matched.map((m) => ({
                                  kind: "matched" as const,
                                  order: m.order ?? Number.MAX_SAFE_INTEGER,
                                  item: m,
                                })),
                                ...row.extras.map((x) => ({
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
                                      <QuarterCells quarters={r.item.quarters} />
                                      <TableCell className="text-right font-mono tabular-nums">
                                        {finalOf(r.item)}
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    <TableRow key={`extra-${r.item.norm}-${r.item.rawName}-${ri}`}>
                                      <TableCell className="font-medium text-foreground">
                                        {r.item.rawName}
                                      </TableCell>
                                      <QuarterCells quarters={r.item.quarters} />
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
                    ))}
                  </div>
                </section>
              ) : null}

              {map.needsReview ? (
                <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  Some years or names could not be read confidently — compare with the file before validating.
                </p>
              ) : null}

              {visibleAddons.length > 0 ? (
                <section className={assign.card} aria-labelledby="addon-subjects">
                  <span className={assign.glowClip} aria-hidden="true">
                    <span className={assign.cardGlow} />
                  </span>
                  <div className="relative">
                    <h2 id="addon-subjects" className="text-base font-semibold">
                      Add-on subjects
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Read from the file with no grade level indicated — kept on record as-is, outside the grade tables.
                    </p>
                  </div>
                  <div className="relative mt-3 overflow-x-auto rounded-lg border border-border">
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
                          <TableHead className="text-right">Q1</TableHead>
                          <TableHead className="text-right">Q2</TableHead>
                          <TableHead className="text-right">Q3</TableHead>
                          <TableHead className="text-right">Q4</TableHead>
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
                </section>
              ) : null}

              {map.sf10Only.length > 0 && perGrade.length === 0 ? (
                <section className={assign.card} aria-labelledby="sf10-only">
                  <span className={assign.glowClip} aria-hidden="true">
                    <span className={assign.cardGlow} />
                  </span>
                  <div className="relative">
                    <h2 id="sf10-only" className="text-base font-semibold">
                      In the file only
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Subjects found in the file that aren&apos;t in the school catalog.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {map.sf10Only.map((s, i) => (
                        <Badge key={`${s.norm}-${i}`} variant="outline" className="font-normal">
                          {s.rawName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </section>
              ) : null}
            </div>

            <div className="space-y-4 lg:space-y-6">
              {/* Actions */}
              <section className={assign.card} aria-label="Record actions">
                <span className={assign.glowClip} aria-hidden="true">
                  <span className={assign.cardGlow} />
                </span>
                <div className="relative flex flex-col gap-2">
                  <h2 className="text-base font-semibold">Record actions</h2>
                  {record.uploadedFileUrl ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={handleViewInNewTab}
                      >
                        <ExternalLink aria-hidden />
                        View in new tab
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
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
                    className="w-full gap-1.5"
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
              </section>

              {/* Record trail */}
              <section className={assign.card} aria-label="Record trail">
                <span className={assign.glowClip} aria-hidden="true">
                  <span className={assign.cardGlow} />
                </span>
                <div className="relative flex flex-col gap-2">
                  <h2 className="text-base font-semibold">Record trail</h2>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Uploaded</dt>
                      <dd>{formatRelativeTime(record.uploadedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Version</dt>
                      <dd>v{record.currentVersion}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Verified by</dt>
                      <dd>{record.verifiedBy ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Validated by</dt>
                      <dd>{record.validatedBy ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Released</dt>
                      <dd>{formatRelativeTime(record.releasedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Updated</dt>
                      <dd>{formatRelativeTime(record.updatedAt)}</dd>
                    </div>
                  </dl>
                </div>
              </section>

              {/* Version history */}
              <section className={assign.card} aria-label="Version history">
                <span className={assign.glowClip} aria-hidden="true">
                  <span className={assign.cardGlow} />
                </span>
                <div className="relative flex flex-col gap-2">
                  <h2 className="text-base font-semibold">Version history</h2>
                  {versions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No versions yet.</p>
                  ) : (
                    <div className={styles.timeline}>
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
                </div>
              </section>
            </div>
          </div>
        </>
      )}
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
    <section className={assign.card} aria-label="Filing progress" aria-busy="true">
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex flex-col items-start gap-2">
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
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4 lg:gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:space-y-6 lg:col-span-2">
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
