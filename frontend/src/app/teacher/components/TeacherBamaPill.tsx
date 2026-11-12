"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { useSession } from "@/lib/auth/useSession";
import { useTeacherOverview } from "@/services/teacher/overview.service";
import { useCachedAdviser } from "@/services/teacher/flagCache";
import styles from "../record-teacher.module.css";

// Adviser-only topbar pill: CRT mascot + "Chat with Bama" → /teacher/chat.
// Hidden for non-advisers (overview flag with cached fallback).
// Accent cycles amber → green → blue → violet every 5s (paused under
// prefers-reduced-motion).
const TONE_CLASSES = [
  styles.bamaToneAmber,
  styles.bamaToneGreen,
  styles.bamaToneBlue,
  styles.bamaToneViolet,
] as const;

export { TONE_CLASSES };

export function TeacherBamaPill() {
  const pathname = usePathname();
  const session = useSession();
  const overview = useTeacherOverview();
  const cachedAdviser = useCachedAdviser(session?.sub);
  const [toneIndex, setToneIndex] = React.useState(0);
  // The adviser flag is only known in the browser (localStorage cache + a query
  // that resolves after hydration), so the server never renders this pill. Gate
  // the first client render on this flag to match the server HTML exactly —
  // otherwise the cached flag inserts an anchor mid-hydration and React throws
  // a hydration mismatch.
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setToneIndex((prev) => (prev + 1) % TONE_CLASSES.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  const isAdviser = overview.data?.isAdviser ?? cachedAdviser ?? false;

  if (!mounted || !isAdviser) return null;

  const active =
    pathname === "/teacher/chat" || pathname?.startsWith("/teacher/chat/") === true;

  return (
    <Link
      href="/teacher/chat?standalone=1"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Bama (opens in a new tab)"
      aria-current={active ? "page" : undefined}
      title="Chat with Bama (opens in a new tab)"
      className={`${styles.bamaPill} ${TONE_CLASSES[toneIndex]} ${active ? styles.bamaPillActive : ""}`}
    >
      <span className={styles.bamaMascot} aria-hidden="true">
        <StudentMascot name="Bama" character="crt" size={24} />
      </span>
      <span className={styles.bamaLabel}>Chat with Bama</span>
    </Link>
  );
}
