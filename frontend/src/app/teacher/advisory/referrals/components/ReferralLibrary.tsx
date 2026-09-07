"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, Landmark, MessagesSquare, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import styles from "./ReferralLibrary.module.css";

const TARGET_ICONS: Record<string, typeof MessagesSquare> = {
  nurse: Stethoscope,
  guidance_counselor: MessagesSquare,
  adm_coordinator: ClipboardList,
  principal: Landmark,
};

const TARGET_ROLE_LABELS: Record<string, string> = {
  nurse: "Nurse",
  guidance_counselor: "Guidance Counselor",
  adm_coordinator: "ADM Coordinator",
  principal: "Principal",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In progress",
  resolved: "Resolved",
};

interface ReferralData {
  id: string;
  studentName: string;
  lrn: string;
  section?: string;
  targetRole: string;
  status: "pending" | "in_progress" | "resolved";
  referredAt: string;
}

interface ReferralLibraryProps {
  referrals: ReferralData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface StudentGroup {
  key: string;
  studentName: string;
  lrn: string;
  section: string;
  referrals: ReferralData[];
}

function groupByStudent(referrals: ReferralData[]): StudentGroup[] {
  const map = new Map<string, StudentGroup>();
  for (const r of referrals) {
    const key = r.lrn || r.studentName;
    if (!map.has(key)) {
      map.set(key, {
        key,
        studentName: r.studentName,
        lrn: r.lrn,
        section: r.section ?? "",
        referrals: [],
      });
    }
    map.get(key)!.referrals.push(r);
  }
  return [...map.values()].sort((a, b) => a.studentName.localeCompare(b.studentName));
}

function initialsOf(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/);
  return `${(parts[0] ?? "S").charAt(0)}${(parts[1] ?? "").charAt(0)}`.toUpperCase();
}

// Floating library content: one entry per student with originated referrals.
// Rendered inside the "My referrals" sheet — opening a student lists only
// that student's referrals, and picking one loads its workflow onto the
// canvas and closes the panel.
export function ReferralLibrary({ referrals, selectedId, onSelect }: ReferralLibraryProps) {
  const [query, setQuery] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const groups = useMemo(() => groupByStudent(referrals), [referrals]);

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!needle) return groups;
    return groups.filter(
      (g) =>
        g.studentName.toLowerCase().includes(needle) ||
        g.lrn.toLowerCase().includes(needle)
    );
  }, [groups, needle]);

  const active = activeKey ? (groups.find((g) => g.key === activeKey) ?? null) : null;

  if (active) {
    const rows = [...active.referrals].sort((a, b) =>
      (b.referredAt ?? "").localeCompare(a.referredAt ?? "")
    );
    return (
      <div className={styles.library}>
        <button type="button" className={styles.back} onClick={() => setActiveKey(null)}>
          <ChevronLeft aria-hidden />
          Back to students
        </button>
        <p className={styles.subhead}>
          {active.studentName} · LRN {active.lrn} — {rows.length} referral{rows.length !== 1 ? "s" : ""}
        </p>
        <div className={styles.items}>
          {rows.map((r) => {
            const Icon = TARGET_ICONS[r.targetRole] ?? MessagesSquare;
            const selected = r.id === selectedId;
            return (
              <button
                key={r.id}
                type="button"
                className={`${styles.item} ${selected ? styles.itemSelected : ""}`}
                aria-pressed={selected}
                onClick={() => onSelect(r.id)}
              >
                <span className={styles.tile} aria-hidden>
                  <Icon />
                </span>
                <span className={styles.itemBody}>
                  <span className={styles.itemName}>
                    {TARGET_ROLE_LABELS[r.targetRole] ?? r.targetRole}
                  </span>
                  <span className={styles.itemMeta}>
                    Referred {r.referredAt ? new Date(r.referredAt).toLocaleDateString() : "—"}
                  </span>
                </span>
                <Badge variant={r.status === "resolved" ? "success" : r.status === "in_progress" ? "warning" : "secondary"}>
                  {STATUS_LABELS[r.status] ?? r.status}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.library}>
      {groups.length > 1 ? (
        <div className={styles.searchRow}>
          <input
            type="search"
            className={styles.search}
            placeholder="Search student or LRN…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search students with referrals"
          />
          <span className={styles.count}>
            {filtered.length} of {groups.length} students
          </span>
        </div>
      ) : null}
      {filtered.length === 0 ? (
        <p className={styles.empty}>No students match “{query.trim()}”.</p>
      ) : (
        <div className={styles.items}>
          {filtered.map((g) => (
            <button
              key={g.key}
              type="button"
              className={styles.item}
              onClick={() => setActiveKey(g.key)}
              aria-label={`Open ${g.studentName}'s referrals (${g.referrals.length})`}
            >
              <span className={styles.avatar} aria-hidden>
                {initialsOf(g.studentName)}
              </span>
              <span className={styles.itemBody}>
                <span className={styles.itemName}>{g.studentName}</span>
                <span className={styles.itemMeta}>
                  LRN {g.lrn}
                  {g.section ? ` · ${g.section}` : ""} · {g.referrals.length} referral
                  {g.referrals.length !== 1 ? "s" : ""}
                </span>
              </span>
              <Badge variant="secondary">{g.referrals.length}</Badge>
              <ChevronRight className={styles.go} aria-hidden />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
