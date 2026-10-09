"use client";

import { useState } from "react";
import { SearchIcon } from "lucide-react";
import { AdvisoryAttendanceList } from "./components/AdvisoryAttendanceList";
import { TeacherPageHeader } from "../../components/TeacherPageHeader";
import { ZentraPageHeaderSkeleton, ZentraFilterBarSkeleton, ZentraTableSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { Users } from "lucide-react";
import { useAdvisoryRoster } from "@/services/teacher/advisory.service";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "@/app/teacher/attendance/components/attendance-sheet.module.css";

export default function AdvisoryAttendancePage() {
  const [sectionId, setSectionId] = useState<string | undefined>(undefined);
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [blankSection, setBlankSection] = useState(false);
  const railOpen = selectedId !== null;

  const advisoryQuery = useAdvisoryRoster();
  const sections = advisoryQuery.data?.advisorySections ?? [];
  const resolvedSectionId = sectionId ?? sections[0]?.id;

  return (
    <section className={styles.page}>
      {advisoryQuery.isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading advisory sections">
          <ZentraPageHeaderSkeleton />
          <ZentraFilterBarSkeleton selects={1} />
          <ZentraTableSkeleton rows={8} columns={4} />
        </div>
      ) : advisoryQuery.isError || sections.length === 0 ? (
        <div className="flex min-h-[calc(100dvh-8rem)] w-full items-center justify-center" aria-label="Advisory Attendance">
          <div className={`${assign.card} w-full max-w-md`}>
            <span className={assign.glowClip} aria-hidden="true">
              <span className={assign.cardGlow} />
            </span>
            <div className="relative flex flex-col items-center gap-2 py-6 text-center">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
                aria-hidden="true"
              >
                <Users size={24} className="text-muted-foreground" />
              </span>
              <p className="font-medium">No advisory section</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Advisory attendance appears here once a section is assigned to you.
              </p>
            </div>
          </div>
        </div>
      ) : (
      <>
      <div
        className={`flex flex-wrap items-start justify-between gap-3 transition-[margin] duration-300 ease-out motion-reduce:transition-none ${
          railOpen ? "lg:mr-[21rem]" : ""
        }`}
      >
        {blankSection ? (
          sections.length > 1 ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Select
                value={resolvedSectionId ?? ""}
                onValueChange={(v) => {
                  setSectionId(v);
                  setSelectedId(null);
                  setBlankSection(false);
                }}
              >
                <SelectTrigger className="w-36" aria-label="Section">
                  <SelectValue placeholder="Select a section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null
        ) : (
          <>
            <TeacherPageHeader
              title="Advisory Attendance"
              description="Daily attendance for your advisory sections."
            />
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {sections.length > 1 ? (
            <Select
              value={resolvedSectionId ?? ""}
              onValueChange={(v) => {
                setSectionId(v);
                setSelectedId(null);
                setBlankSection(false);
              }}
            >
              <SelectTrigger className="w-36" aria-label="Section">
                <SelectValue placeholder="Select a section" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <InputGroup className="max-w-40">
            <InputGroupInput
              placeholder="Filter students..."
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              aria-label="Filter students"
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
        </div>
          </>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-4">
          {resolvedSectionId ? (
            <AdvisoryAttendanceList
              sectionId={resolvedSectionId}
              filter={filter}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onEmptyChange={setBlankSection}
            />
          ) : null}
        </div>
      </>
      )}
    </section>
  );
}
