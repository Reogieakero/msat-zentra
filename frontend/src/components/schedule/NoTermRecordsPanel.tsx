"use client";

import { CalendarDays } from "lucide-react";

interface NoTermRecordsPanelProps {
  termLabel: string;
  isMasterTeacher: boolean;
  teacherName: string;
}

/* Shared "no records for this term" empty panel — identical design and
   message on My Classes and Attendance. Shown only when the login is
   linked but nothing is scheduled for it this term; never beside a code
   input (unlinked logins get the claim card, entered terms need no code). */
export function NoTermRecordsPanel({
  termLabel,
  isMasterTeacher,
  teacherName,
}: NoTermRecordsPanelProps) {
  return (
    <div className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-input bg-card p-12 text-center">
      <span className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10" aria-hidden="true">
        <CalendarDays size={32} className="text-primary" />
      </span>
      <h3 className="text-lg font-semibold">No records for {termLabel} yet</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {isMasterTeacher
          ? "Nothing is scheduled for your login this term yet — schedule subjects in the Schedule workspace. Records open here without a code, and other terms are unaffected."
          : `Nothing is scheduled for ${teacherName} this term yet — your classes will appear here once the master teacher schedules them. Records are kept per term, so other terms are unaffected.`}
      </p>
    </div>
  );
}
