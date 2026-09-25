"use client";

import { useMemo } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import styles from "./ReferralsSidebar.module.css";

export type TrackFilter = "all" | "adm" | "general";

interface ReferralData {
  id: string;
  studentName: string;
  lrn: string;
  section?: string;
  targetRole: string;
  status: "pending" | "in_progress" | "resolved" | "dismissed" | "escalated" | "info_requested" | "follow_up";
  referredAt: string;
  track?: "adm" | "general" | string;
}

interface ReferralsSidebarProps {
  referrals: ReferralData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  query: string;
  onQueryChange: (next: string) => void;
  trackFilter: TrackFilter;
  onTrackFilterChange: (next: TrackFilter) => void;
  /** Initial load: controls stay mounted, list region shows skeleton rows. */
  loading?: boolean;
}

const TARGET_ROLE_LABELS: Record<string, string> = {
  nurse: "Nurse",
  guidance_counselor: "Guidance Counselor",
  adm_coordinator: "ADM Coordinator",
  principal: "Principal",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  resolved: "Resolved",
  dismissed: "Cancelled",
};

// Fallback for unmapped values: no underscores, Title Case
// (e.g. "in_progress" -> "In Progress").
function humanize(value: string | undefined | null): string {
  const words = (value ?? "").replace(/[_-]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

const TRACK_LABELS: Record<TrackFilter, string> = {
  all: "All types",
  adm: "ADM cases",
  general: "Other matters",
};

function groupByStudent(referrals: ReferralData[]) {
  const map = new Map<
    string,
    { studentName: string; lrn: string; section: string; referrals: ReferralData[] }
  >();
  for (const r of referrals) {
    const key = r.lrn || r.studentName;
    if (!map.has(key)) {
      map.set(key, {
        studentName: r.studentName,
        lrn: r.lrn,
        section: r.section ?? "",
        referrals: [],
      });
    }
    map.get(key)!.referrals.push(r);
  }
  return [...map.values()].sort((a, b) =>
    a.studentName.localeCompare(b.studentName)
  );
}

function initialsOf(name: string) {
  const parts = (name ?? "").trim().split(/\s+/);
  return `${(parts[0] ?? "S").charAt(0)}${(parts[1] ?? "").charAt(0)}`.toUpperCase();
}

export function ReferralsSidebar({
  referrals,
  selectedId,
  onSelect,
  onNew,
  query,
  onQueryChange,
  trackFilter,
  onTrackFilterChange,
  loading = false,
}: ReferralsSidebarProps) {
  const groups = useMemo(() => groupByStudent(referrals), [referrals]);

  const { admCount, generalCount } = useMemo(() => {
    let adm = 0;
    let general = 0;
    for (const r of referrals) {
      if (r.track === "adm") adm += 1;
      else general += 1;
    }
    return { admCount: adm, generalCount: general };
  }, [referrals]);

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const byTrack =
      trackFilter === "all"
        ? groups
        : groups
            .map((g) => ({
              ...g,
              referrals: g.referrals.filter((r) =>
                trackFilter === "adm" ? r.track === "adm" : r.track !== "adm"
              ),
            }))
            .filter((g) => g.referrals.length > 0);
    if (!needle) return byTrack;
    return byTrack
      .map((g) => ({
        ...g,
        referrals: g.referrals.filter(
          (r) =>
            g.studentName.toLowerCase().includes(needle) ||
            g.lrn.toLowerCase().includes(needle) ||
            (TARGET_ROLE_LABELS[r.targetRole] ?? r.targetRole)
              .toLowerCase()
              .includes(needle)
        ),
      }))
      .filter((g) => g.referrals.length > 0);
  }, [groups, needle, trackFilter]);

  const totalReferrals = filtered.reduce((n, g) => n + g.referrals.length, 0);

  return (
    <aside className={styles.sidebar} aria-label="My referrals">
      <div className={styles.sidebarHead}>
        <p className={styles.sidebarTitle}>My referrals</p>
        <span className={styles.sidebarCount}>
          {totalReferrals} referral{totalReferrals !== 1 ? "s" : ""}
        </span>
      </div>
      <Button type="button" className={styles.newBtn} onClick={onNew}>
        New referral
      </Button>
      <div className={styles.searchRow}>
        <input
          type="search"
          className={styles.search}
          placeholder="Search student or LRN…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search students with referrals"
        />
      </div>
      <div className={styles.filterRow}>
        <span className={styles.filterLabel} id="referral-track-filter-label">
          Type
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={styles.filterSelect}
              aria-labelledby="referral-track-filter-label"
            >
              <span className={styles.filterSelectText}>
                {TRACK_LABELS[trackFilter]} ({trackFilter === "adm" ? admCount : trackFilter === "general" ? generalCount : admCount + generalCount})
              </span>
              <ChevronDown className={styles.filterSelectIcon} aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={styles.filterMenu}>
            {(
              [
                { value: "all", count: admCount + generalCount },
                { value: "adm", count: admCount },
                { value: "general", count: generalCount },
              ] as { value: TrackFilter; count: number }[]
            ).map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onSelect={() => onTrackFilterChange(opt.value)}
                aria-pressed={trackFilter === opt.value}
              >
                {TRACK_LABELS[opt.value]} ({opt.count})
                {trackFilter === opt.value ? (
                  <Check className={styles.filterCheck} aria-hidden />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {loading ? (
        <div className={styles.items} aria-busy="true" aria-label="Loading referrals">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={styles.group} aria-hidden="true">
              <div className={styles.groupHeader}>
                <Skeleton className={styles.skelAvatar} />
                <span className={styles.itemBody}>
                  <Skeleton className={styles.skelLine} />
                  <Skeleton className={styles.skelLineShort} />
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className={styles.empty}>
          {needle || trackFilter !== "all"
            ? "No referrals match the current filters."
            : "No students match."}
        </p>
      ) : (
        <div className={styles.items} tabIndex={0} aria-label="Referral list">
          {filtered.map((g) => {
            const sorted = [...g.referrals].sort((a, b) =>
              (b.referredAt ?? "").localeCompare(a.referredAt ?? "")
            );
            return (
              <div key={g.lrn || g.studentName} className={styles.group}>
                <div className={styles.groupHeader}>
                  <span className={styles.avatar} aria-hidden>
                    {initialsOf(g.studentName)}
                  </span>
                  <span className={styles.itemBody}>
                    <span className={styles.itemName}>{g.studentName}</span>
                    <span className={styles.itemMeta}>
                      LRN {g.lrn}
                      {g.section ? ` · ${g.section}` : ""}
                    </span>
                  </span>
                  <Badge variant="secondary">{sorted.length}</Badge>
                </div>
                <div className={styles.groupItems}>
                  {sorted.map((r) => {
                    const selected = r.id === selectedId;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        className={`${styles.item} ${selected ? styles.itemSelected : ""}`}
                        aria-pressed={selected}
                        onClick={() => onSelect(r.id)}
                      >
                        <span className={styles.itemBody}>
                          <span className={styles.itemName}>
                            {TARGET_ROLE_LABELS[r.targetRole] ?? humanize(r.targetRole)}
                          </span>
                          <span className={styles.itemMeta}>
                            <span
                              className={`${styles.trackDot} ${r.track === "adm" ? styles.trackDotAdm : styles.trackDotGeneral}`}
                              aria-hidden
                            />
                            {r.track === "adm" ? "ADM case" : "Other matter"}
                            {" · Referred "}
                            {r.referredAt
                              ? new Date(r.referredAt).toLocaleDateString()
                              : "—"}
                          </span>
                        </span>
                        <Badge
                          variant={
                            r.status === "resolved"
                              ? "success"
                              : r.status === "in_progress"
                                ? "warning"
                                : "secondary"
                          }
                        >
                          {STATUS_LABELS[r.status] ?? humanize(r.status)}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}