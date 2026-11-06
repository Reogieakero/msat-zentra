"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Calendar, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { Pill, type PillTone } from "./pill";
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
  /** Set false to hide the leading tone dot (renders a plain rectangle
      pill, e.g. to match a dotless lead pill). */
  dot?: boolean;
}

export interface RowListItem {
  key: string;
  status: { label: string; tone: RowTone };
  /** Primary text (e.g. student name). */
  title: string;
  /** Rectangle id pill rendered after the title (e.g. LRN). */
  idLabel?: string;
  /** Override for the id pill's size/weight (defaults to `text-[11px] font-medium`). */
  idLabelClassName?: string;
  /** Optional rectangle pill rendered before the status pill (e.g. a term
      chip). Renders in a meta tone with no dot; defaults to amber. */
  leadPill?: { label: string; tone?: RowTone };
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
  /** Optional trailing controls (e.g. a row actions menu) rendered at the
      end of the right-hand cell. */
  actions?: ReactNode;
  /** Override for the row aria-label. Defaults to the risk-board phrasing
      `${status.label} risk: ${title}`. */
  ariaLabel?: string;
}

const STATUS_TONE: Record<RowTone, PillTone> = {
  red: "red",
  amber: "amber",
  green: "green",
  blue: "blue",
  muted: "neutral",
};

const META_DOT: Record<RowTone, string> = {
  red: "#ef4444",
  amber: "#f59e0b",
  green: "#22c55e",
  blue: "#3b82f6",
  muted: "#9ca3af",
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : (parts[0]?.[1] ?? "");
  return `${first}${second}`.toUpperCase();
}

function StatusPill({ label, tone }: { label: string; tone: RowTone }) {
  return (
    <Pill
      tone={STATUS_TONE[tone]}
      label="Risk status"
      className="w-fit max-w-full justify-center"
    >
      {label}
    </Pill>
  );
}

function RowListRow({
  item,
  index = 0,
  reduceMotion = false,
  hasLead = false,
}: {
  item: RowListItem;
  index?: number;
  reduceMotion?: boolean;
  /** Whether the list renders the lead pill column (keeps rows aligned
      when only some items carry a lead pill). */
  hasLead?: boolean;
}) {
  return (
    <motion.li
      layout={!reduceMotion}
      className={`${styles.row}${hasLead ? ` ${styles.rowLead}` : ""}`}
      aria-label={item.ariaLabel ?? `${item.status.label} risk: ${item.title}`}
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
      {hasLead ? (
        item.leadPill ? (
          <Pill
            tone={STATUS_TONE[item.leadPill.tone ?? "amber"]}
            label="Term"
            className="w-fit max-w-full justify-center"
          >
            {item.leadPill.label}
          </Pill>
        ) : (
          <span aria-hidden />
        )
      ) : null}
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
          <Pill
            tone="neutral"
            label="LRN"
            title={item.idLabel}
            className={item.idLabelClassName ?? "text-[11px] font-medium"}
          >
            {item.idLabel}
          </Pill>
        ) : null}
      </span>
      <span className={styles.metaCell}>
        {(item.meta ?? []).map((pill, i) => (
          <Pill
            key={`${pill.label}-${i}`}
            tone={STATUS_TONE[pill.tone ?? "muted"]}
            label={pill.title ?? pill.label}
            title={pill.title ?? pill.label}
            className="gap-1"
          >
            {pill.icon ? (
              <pill.icon size={11} aria-hidden />
            ) : pill.dot === false ? null : (
              <span className={styles.metaDot} style={{ background: META_DOT[pill.tone ?? "muted"] }} aria-hidden />
            )}
            {pill.labelNode ?? pill.label}
          </Pill>
        ))}
        {item.detectedLabel ? (
          <Pill
            tone="amber"
            label="Detected"
            title={item.detectedTitle ?? item.detectedLabel}
            className="gap-1"
          >
            <Calendar size={11} aria-hidden />
            {item.detectedLabel}
          </Pill>
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
        {item.actions ?? null}
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
  animateOnMount = false,
}: {
  items: RowListItem[];
  emptyText?: string;
  ariaLabel?: string;
  /** Full-bleed row dividers inside a guttered container. */
  bleed?: boolean;
  /** Container gutter the bleed cancels (default 1.125rem card gutter). */
  gutter?: string;
  /** Run the staggered mount animation on first paint (e.g. kanban boards
      that cascade like their KPI stats). Off by default so refetches and
      filter changes don't re-animate existing rows. */
  animateOnMount?: boolean;
}) {
  if (items.length === 0) {
    return <p className={styles.empty}>{emptyText}</p>;
  }
  return (
    <AnimatedRowUl
      items={items}
      ariaLabel={ariaLabel}
      bleed={bleed}
      gutter={gutter}
      animateOnMount={animateOnMount}
    />
  );
}

function AnimatedRowUl({
  items,
  ariaLabel,
  bleed,
  gutter,
  animateOnMount,
}: {
  items: RowListItem[];
  ariaLabel: string;
  bleed: boolean;
  gutter?: string;
  animateOnMount: boolean;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const hasLead = items.some((item) => item.leadPill != null);
  return (
    <motion.ul
      layout={!reduceMotion}
      className={`${styles.list}${bleed ? ` ${styles.listBleed}` : ""}${hasLead ? ` ${styles.listLead}` : ""}`}
      style={gutter ? ({ "--row-list-gutter": gutter } as CSSProperties) : undefined}
      aria-label={ariaLabel}
      transition={{ layout: { duration: 0.28, ease: "easeOut" } }}
    >
      <AnimatePresence initial={animateOnMount}>
        {items.map((item, index) => (
          <RowListRow
            key={item.key}
            item={item}
            index={index}
            reduceMotion={reduceMotion}
            hasLead={hasLead}
          />
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}
