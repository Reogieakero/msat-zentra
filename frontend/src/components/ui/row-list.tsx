"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Calendar, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import styles from "./row-list.module.css";

export type RowTone = "red" | "amber" | "green" | "blue" | "muted";

export interface RowListMetaPill {
  label: string;
  tone?: RowTone;
  title?: string;
  /** Icon rendered in place of the dot (e.g. factor icons). */
  icon?: LucideIcon;
  /** Rich rendering for the label (e.g. two-tone numerator/denominator).
      Falls back to `label` when omitted; `label` stays the a11y/key string. */
  labelNode?: ReactNode;
}

export interface RowListItem {
  key: string;
  status: { label: string; tone: RowTone };
  /** Primary text (e.g. student name). */
  title: string;
  /** Rectangle id pill rendered after the title (e.g. LRN). */
  idLabel?: string;
  /** Right-side factor pills. */
  meta?: RowListMetaPill[];
  /** Optional detected/snapshot date pill on the right. Omit when unknown. */
  detectedLabel?: string;
  detectedTitle?: string;
  /** Initials source for the trailing avatar. Defaults to title.
      Ignored when `avatarMascot` is set. */
  avatarSource?: string;
  /** Stored sprite mascot rendered in a row with the title (same as the
      student list). Replaces the trailing initials avatar when set. */
  avatarMascot?: {
    name: string;
    seed: string;
    character?: string | null;
    size?: number;
  };
}

const STATUS_TONE: Record<RowTone, string> = {
  red: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  green: "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400",
  blue: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  muted: "border-border bg-muted text-muted-foreground",
};

const META_TONE: Record<RowTone, string> = {
  red: "border-red-500/40 bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  amber: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  green: "border-green-500/40 bg-green-500/15 text-green-700 dark:bg-green-500/20 dark:text-green-400",
  blue: "border-blue-500/40 bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  muted: "border-border bg-secondary text-secondary-foreground",
};

const META_DOT: Record<RowTone, string> = {
  red: "#ef4444",
  amber: "#f59e0b",
  green: "#22c55e",
  blue: "#3b82f6",
  muted: "#9ca3af",
};

/* Single shared pill metric — status and factor pills render identical
   padding/height. */
const PILL_BASE =
  "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : (parts[0]?.[1] ?? "");
  return `${first}${second}`.toUpperCase();
}

function StatusPill({ label, tone }: { label: string; tone: RowTone }) {
  return (
    <span className={`w-fit max-w-full justify-center ${PILL_BASE} ${STATUS_TONE[tone]}`}>
      {label}
    </span>
  );
}

function RowListRow({ item, index = 0, reduceMotion = false }: { item: RowListItem; index?: number; reduceMotion?: boolean }) {
  return (
    <motion.li
      layout={!reduceMotion}
      className={styles.row}
      aria-label={`${item.status.label} risk: ${item.title}`}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -6, transition: { duration: 0.18 } }}
      transition={{
        duration: 0.38,
        ease: "easeOut",
        // Stagger the first ~10 rows; cap delay so long lists stay snappy
        // and filtering feels instant.
        delay: reduceMotion ? 0 : Math.min(index * 0.035, 0.35),
        layout: { duration: 0.28, ease: "easeOut" },
      }}
      style={{ willChange: "transform, opacity" }}
    >
      <StatusPill label={item.status.label} tone={item.status.tone} />
      <span className={styles.sep} aria-hidden>
        |
      </span>
      <span className={styles.titleCell}>
        {item.avatarMascot ? (
          <StudentMascot
            name={item.avatarMascot.name}
            seed={item.avatarMascot.seed}
            character={item.avatarMascot.character ?? undefined}
            size={item.avatarMascot.size ?? 28}
          />
        ) : null}
        <span className={styles.title} title={item.title}>
          {item.title}
        </span>
        {item.idLabel ? (
          <span
            className="inline-flex shrink-0 items-center rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground"
            title={item.idLabel}
          >
            {item.idLabel}
          </span>
        ) : null}
      </span>
      <span className={styles.metaCell}>
        {(item.meta ?? []).map((pill, i) => (
          <span
            key={`${pill.label}-${i}`}
            title={pill.title ?? pill.label}
            className={`${PILL_BASE} gap-1 ${META_TONE[pill.tone ?? "muted"]}`}
          >
            {pill.icon ? (
              <pill.icon size={11} aria-hidden />
            ) : (
              <span className={styles.metaDot} style={{ background: META_DOT[pill.tone ?? "muted"] }} aria-hidden />
            )}
            {pill.labelNode ?? pill.label}
          </span>
        ))}
        {item.detectedLabel ? (
          <span
            title={item.detectedTitle ?? item.detectedLabel}
            className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
          >
            <Calendar size={11} aria-hidden />
            {item.detectedLabel}
          </span>
        ) : null}
        {item.avatarMascot ? null : (
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground"
            aria-hidden
            title={item.avatarSource ?? item.title}
          >
            {initialsOf(item.avatarSource ?? item.title)}
          </span>
        )}
      </span>
    </motion.li>
  );
}

export function RowList({
  items,
  emptyText = "Nothing here.",
  ariaLabel = "Rows",
  bleed = false,
  gutter,
}: {
  items: RowListItem[];
  emptyText?: string;
  ariaLabel?: string;
  /** Full-bleed row dividers inside a guttered container. */
  bleed?: boolean;
  /** Container gutter the bleed cancels (default 1.125rem card gutter). */
  gutter?: string;
}) {
  if (items.length === 0) {
    return <p className={styles.empty}>{emptyText}</p>;
  }
  return <AnimatedRowUl items={items} ariaLabel={ariaLabel} bleed={bleed} gutter={gutter} />;
}

function AnimatedRowUl({
  items,
  ariaLabel,
  bleed,
  gutter,
}: {
  items: RowListItem[];
  ariaLabel: string;
  bleed: boolean;
  gutter?: string;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  return (
    <motion.ul
      layout={!reduceMotion}
      className={`${styles.list} ${bleed ? styles.listBleed : ""}`}
      style={gutter ? ({ "--row-list-gutter": gutter } as CSSProperties) : undefined}
      aria-label={ariaLabel}
      transition={{ layout: { duration: 0.28, ease: "easeOut" } }}
    >
      <AnimatePresence initial={false}>
        {items.map((item, index) => (
          <RowListRow key={item.key} item={item} index={index} reduceMotion={reduceMotion} />
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}
