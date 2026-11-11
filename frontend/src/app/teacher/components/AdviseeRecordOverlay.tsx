"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "@/lib/api/live";
import {
  ArrowUpRight,
  BookOpen,
  FilePenLine,
  FileText,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { FolderCard, type FolderFile } from "@/components/ui/FolderCard";
import { InsightCallout } from "@/components/ui/insight-callout";
import { Pill } from "@/components/ui/pill";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import {
  ANECDOTAL_CATEGORY_COLORS,
  ANECDOTAL_CATEGORY_TONES,
  humanizeCategory,
} from "@/components/anecdotal/anecdotal-record-kanban-card";
import { apiClient } from "@/lib/api/client";
import { fetchStudentAcademic } from "@/services/teacher/adviseeAcademic.service";
import type { AdviseeRow } from "@/services/teacher/advisory.types";
import type { HasRow } from "@/services/teacher/sf10Access.service";

interface AnecdotalRecordItem {
  id: string;
  observationDatetime: string;
  category: string;
  confidentialityLevel: string;
  mine?: boolean;
  location?: string;
  incident?: string;
  notes?: string;
  followupCount?: number;
}

interface AnecdotalResponse {
  student: { studentId: string; name: string; lrn: string; section: string };
  records: AnecdotalRecordItem[];
}

async function fetchAdviseeAnecdotal(
  studentId: string,
): Promise<AnecdotalResponse> {
  const { data } = await apiClient.get<AnecdotalResponse>(
    `/api/teacher/advisory/students/${encodeURIComponent(studentId)}/anecdotal`,
  );
  return data;
}

const STATUS_TONES: Record<HasRow["sf10Status"], 1 | 2 | 3 | 4 | 5> = {
  pending: 1,
  verified: 3,
  validated: 5,
};

function statusLabel(status: HasRow["sf10Status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function fileExtOf(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  } catch {
    return url.split("?")[0].split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  }
}

/** Folder slip icon for a file extension — same mapping as the SF10 desk. */
function iconOf(ext: string): FolderFile["icon"] {
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  if (["xlsx", "xls"].includes(ext)) return "chart";
  return "doc";
}

function isSpreadsheetUrl(url: string): boolean {
  const ext = fileExtOf(url);
  return ext === "xlsx" || ext === "xls";
}

function externalHref(fileUrl: string): string {
  // Browsers download xlsx instead of previewing it — route spreadsheets
  // through the Office viewer like the rest of the record desks do.
  return isSpreadsheetUrl(fileUrl)
    ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`
    : fileUrl;
}

function recordDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/**
 * Folder shell shared by the three record columns — the exact card used by the
 * SF10 and anecdotal desks: muted shell + header row with icon and label.
 */
function FolderColumn({
  icon,
  title,
  headerRight,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 text-left [font-family:var(--font-inter)] dark:bg-muted/20">
      <div className="-mx-2.5 flex min-w-0 items-center justify-between gap-1.5 border-b border-border px-3.5 pb-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
          <span className="text-amber-500" aria-hidden>
            {icon}
          </span>
          <span className="truncate">{title}</span>
        </span>
        {headerRight ?? null}
      </div>
      {children}
    </div>
  );
}

/**
 * Student record folders opened from the topbar search: SF10 permanent record,
 * anecdotal records and the academic kanban, all in one overlay. The SF10 file
 * opens in its own browser tab; anecdotal records open in a nested overlay;
 * academics leaves the overlay for its page.
 */
export function AdviseeRecordOverlay({
  student,
  sf10,
  onClose,
}: {
  student: AdviseeRow | null;
  sf10: HasRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const studentId = student?.studentId ?? null;
  const [anecdotalPreview, setAnecdotalPreview] = React.useState<{
    studentId: string;
    recordId: string;
  } | null>(null);
  const anecdotalPreviewId =
    studentId && anecdotalPreview?.studentId === studentId
      ? anecdotalPreview.recordId
      : null;
  // A preview sits on top of the folder overlay — while one is open, Esc and
  // outside clicks belong to it, not to the folders underneath.
  const previewOpen = anecdotalPreviewId !== null;

  const academic = useLiveQuery({
    queryKey: ["advisee-academic", studentId],
    queryFn: () => fetchStudentAcademic(studentId as string),
    enabled: !!studentId,
    staleTime: 30_000,
  });
  const anecdotal = useLiveQuery({
    queryKey: ["advisee-anecdotal", studentId],
    queryFn: () => fetchAdviseeAnecdotal(studentId as string),
    enabled: !!studentId,
    staleTime: 30_000,
  });

  const records = React.useMemo(
    () => anecdotal.data?.records ?? [],
    [anecdotal.data],
  );
  const liveGrades = React.useMemo(
    () => student?.liveGrades ?? [],
    [student],
  );
  const generalAverage = React.useMemo(() => {
    const values = (
      liveGrades.length > 0
        ? liveGrades.map((g) => g.average)
        : (academic.data?.grades ?? []).map((g) => g.computedAverage)
    ).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }, [liveGrades, academic.data]);

  const sf10FileUrl = sf10?.record?.fileUrl ?? null;
  const sf10Ext = fileExtOf(sf10FileUrl ?? "");
  const sf10Slip: FolderFile = {
    name: sf10Ext ? `SF10.${sf10Ext}` : "SF10 file",
    tag: sf10
      ? `${statusLabel(sf10.sf10Status)} · ${sf10.gradeLevel} · ${sf10.section}`
      : "No record on file",
    tone: sf10 ? STATUS_TONES[sf10.sf10Status] : 1,
    icon: iconOf(sf10Ext),
  };

  const anecdotalSlips: FolderFile[] = records.slice(0, 5).map((record) => ({
    name: `GCForm-01_${recordDate(record.observationDatetime)}`,
    tag: humanizeCategory(record.category),
    tone: ANECDOTAL_CATEGORY_TONES[record.category] ?? 1,
    icon: "doc",
  }));
  const anecdotalColor =
    ANECDOTAL_CATEGORY_COLORS[records[0]?.category ?? ""] ?? "#f59e0b";

  const openAccessDesk = () => {
    if (!student) return;
    onClose();
    router.push(
      `/teacher/advisory/sf10-access?lrn=${encodeURIComponent(student.lrn)}`,
    );
  };

  const handleAcademics = () => {
    if (!student) return;
    onClose();
    router.push(
      `/teacher/advisory/students?highlight=${encodeURIComponent(student.studentId)}`,
    );
  };

  return (
    <>
      <Dialog
        open={student !== null}
        /* The raised GCForm-01 preview is a separate portal (not a Radix
           dialog), so the Radix scroll lock would swallow wheel/touch events
           over it and freeze the preview. Hand modality to the preview while
           it is open — it covers this dialog anyway. */
        modal={!previewOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent
          className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 shadow-none sm:max-w-4xl"
          onEscapeKeyDown={(event) => {
            if (previewOpen) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (previewOpen) event.preventDefault();
          }}
        >
          <DialogTitle className="sr-only">Student records</DialogTitle>
          <DialogDescription className="sr-only">
            Permanent record folders for this student: SF10, anecdotal and academics.
          </DialogDescription>

          {student ? (
            <>
              <header className="flex items-center gap-3 border-b border-border p-4 pr-12">
                <StudentMascot
                  name={student.name}
                  seed={student.lrn}
                  character={student.mascot ?? undefined}
                  size={40}
                />
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {student.name}
                  </p>
                  <div className="flex flex-wrap items-center gap-1">
                    <Pill tone="neutral" label="LRN">
                      {student.lrn}
                    </Pill>
                    <Pill tone="neutral" label="Section">
                      {student.section}
                    </Pill>
                  </div>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {/* SF10 — folder opens the file in a new tab; no record → callout. */}
                  <FolderColumn
                    icon={<FileText size={14} />}
                    title="SF10"
                    headerRight={
                      sf10 ? (
                        <Pill tone="green" label="SF10 status">
                          {statusLabel(sf10.sf10Status)}
                        </Pill>
                      ) : undefined
                    }
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border bg-white p-3 shadow-sm dark:bg-card">
                      {sf10FileUrl ? (
                        <>
                          <div className="flex w-full justify-center">
                            <div className="w-full max-w-[200px]">
                              <FolderCard
                                label=""
                                folderColor="#f59e0b"
                                files={[sf10Slip]}
                                onCardClick={() => {
                                  if (!sf10FileUrl) return;
                                  window.open(
                                    externalHref(sf10FileUrl),
                                    "_blank",
                                    "noopener,noreferrer",
                                  );
                                }}
                                cardAriaLabel={`Open ${student.name}'s SF10 record`}
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            {sf10?.record?.currentVersion ? (
                              <Pill label="Current version">
                                v{sf10.record.currentVersion}
                              </Pill>
                            ) : (
                              <span />
                            )}
                            <span className="text-[11px] text-muted-foreground">
                              Opens in a new tab
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <InsightCallout role="status" className="text-left">
                            <strong>No SF10 on file yet.</strong> The permanent
                            record appears here once the registrar releases it.
                          </InsightCallout>
                          <Button
                            type="button"
                            size="sm"
                            className="mt-auto h-6 self-end px-2 text-xs"
                            onClick={openAccessDesk}
                          >
                            Open the SF10 access desk
                            <ArrowUpRight aria-hidden />
                          </Button>
                        </>
                      )}
                    </div>
                  </FolderColumn>

                  {/* Anecdotal — slips open the filed GCForm-01 overlay. */}
                  <FolderColumn
                    icon={<FilePenLine size={14} />}
                    title="Anecdotal"
                    headerRight={
                      <Pill label="Records filed">{student.anecdotalCount}</Pill>
                    }
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border bg-white p-3 shadow-sm dark:bg-card">
                      {anecdotal.isPending ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2
                            className="size-4 animate-spin text-muted-foreground"
                            aria-hidden
                          />
                        </div>
                      ) : records.length === 0 ? (
                        <InsightCallout role="status" className="text-left">
                          <strong>No anecdotal records this term.</strong> Filed
                          GCForm-01 records will open here.
                        </InsightCallout>
                      ) : (
                        <>
                          <div className="flex w-full justify-center">
                            <div className="w-full max-w-[200px]">
                              <FolderCard
                                label=""
                                folderColor={anecdotalColor}
                                files={anecdotalSlips}
                                onCardClick={() =>
                                  setAnecdotalPreview({
                                    studentId: student.studentId,
                                    recordId: records[0]!.id,
                                  })
                                }
                                onFileClick={(index) =>
                                  setAnecdotalPreview({
                                    studentId: student.studentId,
                                    recordId: records[index]!.id,
                                  })
                                }
                                cardAriaLabel={`Open ${student.name}'s latest anecdotal record`}
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <span className="text-[11px] text-muted-foreground">
                              Opens the filed record
                            </span>
                            {records.length > 5 ? (
                              <span className="text-[11px] text-muted-foreground">
                                +{records.length - 5} more
                              </span>
                            ) : null}
                          </div>
                        </>
                      )}
                    </div>
                  </FolderColumn>

                  {/* Academics — the advisory kanban card; the only link out. */}
                  <button
                    type="button"
                    onClick={handleAcademics}
                    aria-label={`Open ${student.name}'s academic board`}
                    className="flex min-w-0 cursor-pointer flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 text-left transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow dark:bg-muted/20"
                  >
                    <span className="-mx-2.5 flex min-w-0 items-center justify-between gap-1.5 border-b border-border px-3.5 pb-2">
                      <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
                        <BookOpen size={14} className="text-amber-500" aria-hidden />
                        <span className="truncate">Academics</span>
                      </span>
                      <Pill label="Live subjects">{liveGrades.length}</Pill>
                    </span>

                    <span className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border bg-white p-3 shadow-sm dark:bg-card">
                      <span className="flex min-w-0 flex-col gap-1.5 rounded-md border border-border bg-card p-2.5">
                        <span className="flex items-center justify-between gap-2">
                          <Pill tone="blue" label="Live general average">
                            General average
                          </Pill>
                          <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <BookOpen size={14} aria-hidden />
                          </span>
                        </span>
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13px] font-bold">
                            Live academics
                          </span>
                          <span className="text-[22px] font-extrabold leading-none tabular-nums">
                            {generalAverage === null ? "—" : generalAverage.toFixed(1)}
                            <span className="ml-1 text-[10px] font-medium text-muted-foreground">
                              avg
                            </span>
                          </span>
                        </span>
                      </span>

                      {liveGrades.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground">
                          No live scores shared by subject teachers yet.
                        </span>
                      ) : (
                        <span className="flex min-w-0 flex-col gap-1.5">
                          {liveGrades.slice(0, 3).map((g) => (
                            <span
                              key={g.code}
                              className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-1.5"
                            >
                              <span className="truncate text-[12px] font-semibold">
                                {g.subject}
                              </span>
                              <span className="text-[13px] font-bold tabular-nums">
                                {g.average.toFixed(1)}
                              </span>
                            </span>
                          ))}
                          {liveGrades.length > 3 ? (
                            <span className="text-[11px] text-muted-foreground">
                              +{liveGrades.length - 3} more subject
                              {liveGrades.length - 3 === 1 ? "" : "s"}
                            </span>
                          ) : null}
                        </span>
                      )}

                      <span className="text-[11px] text-muted-foreground">
                        Open the academic board
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <OcForm01PreviewDialog
        recordId={anecdotalPreviewId}
        raised
        onClose={() => setAnecdotalPreview(null)}
      />
    </>
  );
}
