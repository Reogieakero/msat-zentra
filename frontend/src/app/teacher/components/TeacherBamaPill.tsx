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

export function TeacherBamaPill() {
  const pathname = usePathname();
  const session = useSession();
  const overview = useTeacherOverview();
  const cachedAdviser = useCachedAdviser(session?.sub);
  const [toneIndex, setToneIndex] = React.useState(0);

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setToneIndex((prev) => (prev + 1) % TONE_CLASSES.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  const isAdviser = overview.data?.isAdviser ?? cachedAdviser ?? false;

  if (!isAdviser) return null;

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
