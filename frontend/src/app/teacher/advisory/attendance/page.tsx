"use client";

import { useState } from "react";
import { SearchIcon } from "lucide-react";
import { AdvisoryAttendanceList } from "./components/AdvisoryAttendanceList";
import { useAdvisoryRoster } from "@/services/teacher/advisory.service";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import styles from "@/app/teacher/attendance/components/attendance-sheet.module.css";

export default function AdvisoryAttendancePage() {
  const [sectionId, setSectionId] = useState<string | undefined>(undefined);
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const railOpen = selectedId !== null;

  const advisoryQuery = useAdvisoryRoster();
  const sections = advisoryQuery.data?.advisorySections ?? [];
  const resolvedSectionId = sectionId ?? sections[0]?.id;

  return (
    <section className={styles.page}>
      <div
        className={`flex flex-wrap items-start justify-between gap-3 transition-[margin] duration-300 ease-out motion-reduce:transition-none ${
          railOpen ? "lg:mr-[21rem]" : ""
        }`}
      >
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Advisory Attendance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Daily attendance for your advisory sections.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {sections.length > 1 ? (
            <Select
              value={resolvedSectionId ?? ""}
              onValueChange={(v) => {
                setSectionId(v);
                setSelectedId(null);
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
      </div>

      {advisoryQuery.isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading advisory sections">
          <div className="h-24 rounded-xl border border-input bg-card" />
          <div className="h-48 rounded-xl border border-input bg-card" />
        </div>
      ) : advisoryQuery.isError || sections.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-input bg-card p-12 text-center">
          <h3 className="text-lg font-semibold">No advisory section</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Advisory attendance appears here once a section is assigned to you.
          </p>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          {resolvedSectionId ? (
            <AdvisoryAttendanceList
              sectionId={resolvedSectionId}
              filter={filter}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}
