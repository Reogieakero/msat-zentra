"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { useSf10BulkUpload } from "@/components/registry/sf10/sf10-bulk-upload-context";

// Floating Bama bubble on every teacher page (Drive-style), except
// /teacher/advisory/referrals, /teacher/advisory/adm-cases, and
// /teacher/grading which already surface starter kanban cards. Above page
// content but below every overlay (modals sit at z-50+), so dialogs always
// cover it. CRT mascot + new tab, same as the navbar pill. Slides left of
// the SF10 bulk dock while a run is afloat so the two never stack.
export function BamaFab() {
  const pathname = usePathname();
  const { uploading, filedFlash } = useSf10BulkUpload();
  if (
    pathname?.startsWith("/teacher/advisory/referrals") === true ||
    pathname?.startsWith("/teacher/advisory/adm-cases") === true ||
    pathname?.startsWith("/teacher/grading") === true
  )
    return null;
  const dockOpen = uploading || filedFlash;

  return (
    <Link
      href="/teacher/chat?standalone=1"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Bama (opens in a new tab)"
      title="Chat with Bama (opens in a new tab)"
      className={`fixed bottom-6 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105 hover:shadow-xl ${
        dockOpen ? "right-[22rem] sm:right-[26rem]" : "right-6"
      }`}
    >
      <span aria-hidden="true" className="overflow-hidden rounded-full">
        <StudentMascot name="Bama" character="crt" size={32} />
      </span>
    </Link>
  );
}
