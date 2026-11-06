"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import { Search } from "lucide-react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Pill } from "@/components/ui/pill";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { buildNav } from "@/components/teacher-sidebar";
import {
  sf10StatusLabel,
  sf10StatusTone,
} from "@/lib/labels/status-tone";
import { useTeacherOverview } from "@/services/teacher/overview.service";
import {
  useCachedAdviser,
  useCachedMasterTeacher,
} from "@/services/teacher/flagCache";
import { useAdvisoryRoster } from "@/services/teacher/advisory.service";
import {
  fetchMyVerification,
  useMyAccessRequests,
  type HasRow,
} from "@/services/teacher/sf10Access.service";
import { useSession } from "@/lib/auth/useSession";
import type { AdviseeRow } from "@/services/teacher/advisory.types";
import { AdviseeRecordOverlay } from "./AdviseeRecordOverlay";
import styles from "../record-teacher.module.css";

// Supabase-style command palette: the topbar search is a trigger, not an
// input — clicking it (or Cmd/Ctrl+K) opens a centered modal.
//
// Advisers use it to find student permanent records (SF10): the roster is the
// searchable set, enriched with the record's version / lifecycle status when
// the registrar has granted access. Everyone else gets page navigation.
export function TeacherGlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [shortcut, setShortcut] = React.useState("⌘K");
  // Picking a student closes the palette and opens the record-folder overlay
  // (SF10 / anecdotal / academics) instead of navigating away.
  const [selected, setSelected] = React.useState<{
    student: AdviseeRow;
    sf10: HasRow | null;
  } | null>(null);

  const session = useSession();
  const overview = useTeacherOverview();
  const cachedMaster = useCachedMasterTeacher(session?.sub);
  const isMasterTeacher =
    overview.data?.isMasterTeacher ||
    overview.data?.isMasterTeacherSenior ||
    cachedMaster;
  const cachedAdviser = useCachedAdviser(session?.sub);
  const isAdviser = overview.data?.isAdviser ?? cachedAdviser ?? true;

  const groups = React.useMemo(
    () => buildNav(isMasterTeacher, isAdviser),
    [isMasterTeacher, isAdviser],
  );

  // Permanent-record search (advisers): roster + granted SF10 rows. The
  // access queries stay disabled until the palette opens so the topbar
  // doesn't pay for them on every page.
  const roster = useAdvisoryRoster();
  const accessRequests = useMyAccessRequests(open && isAdviser);
  const requestIds = React.useMemo(
    () => (isAdviser ? (accessRequests.data ?? []).map((r) => r.id) : []),
    [isAdviser, accessRequests.data],
  );
  const verifications = useQueries({
    queries: requestIds.map((id) => ({
      queryKey: ["teacher-sf10-access", id, "records"],
      queryFn: () => fetchMyVerification(id),
      staleTime: 30_000,
      enabled: open,
    })),
  });
  const recordByLrn = React.useMemo(() => {
    const byLrn = new Map<string, HasRow>();
    for (const q of verifications) {
      for (const row of q.data?.hasSf10 ?? []) {
        if (row.approved && !byLrn.has(row.lrn)) byLrn.set(row.lrn, row);
      }
    }
    return byLrn;
  }, [verifications]);
  const advisees = roster.data?.students ?? [];

  React.useEffect(() => {
    // Browser-only: navigator is unavailable during SSR, so the kbd hint is
    // resolved after mount instead of at first render.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only platform sniff
    setShortcut(
      /mac|iphone|ipad/i.test(navigator.platform) ? "⌘K" : "Ctrl K",
    );
  }, []);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "k" ||
        !(event.metaKey || event.ctrlKey) ||
        event.repeat
      ) {
        return;
      }
      // Don't hijack the shortcut while the user is typing in a form field.
      const target = event.target as HTMLElement | null;
      const editing =
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT";
      if (editing) return;
      event.preventDefault();
      setOpen((prev) => !prev);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        className={styles.searchTrigger}
        onClick={() => setOpen(true)}
        aria-label={isAdviser ? "Search student permanent records" : "Search teacher pages"}
        aria-haspopup="dialog"
      >
        <Search className={styles.searchTriggerIcon} aria-hidden />
        <span className={styles.searchTriggerText}>
          {isAdviser ? "Search records…" : "Search…"}
        </span>
        <kbd className={styles.searchKbd}>{shortcut}</kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description={
          isAdviser
            ? "Search student permanent records"
            : "Search teacher pages and tools"
        }
        className="top-1/2 w-full max-w-xl -translate-y-1/2 shadow-none sm:max-w-xl"
      >
        <Command>
          <CommandInput
            placeholder={
              isAdviser ? "Search student name or LRN…" : "Search pages…"
            }
            autoFocus
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {isAdviser ? (
              <CommandGroup heading="Student permanent records">
                {advisees.map((student) => {
                  const record = recordByLrn.get(student.lrn);
                  const version = record?.record?.currentVersion;
                  return (
                    <CommandItem
                      key={student.studentId}
                      value={`${student.name} ${student.lrn} ${student.section}`}
                      onSelect={() => {
                        setOpen(false);
                        setSelected({ student, sf10: record ?? null });
                      }}
                    >
                      <StudentMascot
                        name={student.name}
                        seed={student.lrn}
                        character={student.mascot ?? undefined}
                        size={28}
                      />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="truncate">{student.name}</span>
                        <span className="flex min-w-0 flex-wrap items-center gap-1">
                          <Pill tone="neutral" label="LRN">
                            {student.lrn}
                          </Pill>
                          {student.section ? (
                            <Pill tone="neutral" label="Section">
                              {student.section}
                            </Pill>
                          ) : null}
                        </span>
                      </span>
                      {record ? (
                        <span className="ml-auto flex shrink-0 items-center gap-1 pl-2">
                          <Pill
                            tone={sf10StatusTone(record.sf10Status)}
                            label="SF10 status"
                          >
                            {sf10StatusLabel(record.sf10Status)}
                          </Pill>
                          {version ? (
                            <Pill tone="neutral" label="Current version">
                              v{version}
                            </Pill>
                          ) : null}
                        </span>
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : (
              groups.map((group) => (
                <CommandGroup key={group.label} heading={group.label}>
                  {group.items.map((item) => (
                    <CommandItem
                      key={item.href}
                      value={`${item.title} ${item.href}`}
                      onSelect={() => handleSelect(item.href)}
                    >
                      <item.icon aria-hidden />
                      <span>{item.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))
            )}
          </CommandList>
        </Command>
      </CommandDialog>

      <AdviseeRecordOverlay
        student={selected?.student ?? null}
        sf10={selected?.sf10 ?? null}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
