"use client";
import { useMemo, useState } from "react";
import { WEEK_LABELS_SHORT } from "@/services/teacher/schedule";
import {
  buildTimetable,
  formatRange,
  type DayConfig,
} from "@/app/teacher/schedule/components/schedule-time";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { AttendancePair } from "./use-attendance-pairs";
export interface SlotCard {
  key: string;
  pairKey: string;
  section: { id: string; name: string; gradeLevel: string | null };
  subject: { id: string; name: string; code: string };
  day: number;
  period: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  time: string | null;
  start: number | null;
  end: number | null;
  live: boolean;
  rank: number;
  haystack: string;
}
export function useSlotCards(pairs: AttendancePair[], config: DayConfig | undefined, now: Date) {
  const [slotQuery, setSlotQuery] = useState("");
  const debouncedSlotQuery = useDebouncedValue(slotQuery, 250);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todayDow = now.getDay();
  const slotCards = useMemo(() => {
    const rows = config ? buildTimetable(config) : [];
    const timeFor = (period: number): string | null => {
      if (!config) return null;
      const row = buildTimetable(config).find((r) => r.kind === "period" && r.periodIndex === period);
      return row && row.kind === "period" ? formatRange(row.startMin, row.endMin) : null;
    };
    const rangeOf = (period: number): { start: number; end: number } | null => {
      const row = rows.find((r) => r.kind === "period" && r.periodIndex === period);
      return row && row.kind === "period" ? { start: row.startMin, end: row.endMin } : null;
    };
    const cards: SlotCard[] = [];
    for (const p of pairs) {
      if (!p.subject) continue;
      for (const s of p.slots) {
        const t = timeFor(s.period);
        const range = rangeOf(s.period);
        const timeLabel = `${WEEK_LABELS_SHORT[s.day - 1]} ${t ?? `Period ${s.period + 1}`}`;
        let rank: number;
        let live = false;
        if (s.day === todayDow && range) {
          if (nowMin >= range.start && nowMin < range.end) {
            rank = -1;
            live = true;
          } else if (nowMin < range.start) {
            rank = range.start;
          } else {
            rank = 100000 - range.end;
          }
        } else {
          const offset = (((s.day - todayDow) % 7) + 7) % 7;
          rank = offset === 0 ? 300000 : 200000 + offset * 10000 + (range?.start ?? 0);
        }
        cards.push({
          key: `${p.key}|${s.day}|${s.period}`,
          pairKey: p.key,
          section: p.section,
          subject: p.subject,
          day: s.day,
          period: s.period,
          status: s.status,
          time: t,
          start: range?.start ?? null,
          end: range?.end ?? null,
          live,
          rank,
          haystack: `${p.subject.name} ${p.subject.code} ${p.section.name} ${timeLabel}`.toLowerCase(),
        });
      }
    }
    const q = debouncedSlotQuery.trim().toLowerCase();
    return cards
      .filter((c) => q === "" || c.haystack.includes(q))
      .sort((a, b) => a.rank - b.rank);
  }, [pairs, config, nowMin, todayDow, debouncedSlotQuery]);
  return { slotCards, slotQuery, setSlotQuery };
}
