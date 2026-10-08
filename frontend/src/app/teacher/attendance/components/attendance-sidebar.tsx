"use client";
import { useMemo, useRef } from "react";
import { BookOpen, Search } from "lucide-react";
import BranchedMenu from "@/components/nav/BranchedMenu";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { ScrollDownHint } from "@/components/ui/scroll-down-hint";
import { WEEK_LABELS_SHORT } from "@/services/teacher/schedule";
import styles from "./attendance-sheet.module.css";
import type { SlotCard } from "./use-slot-cards";
export function AttendanceSidebar({
  slotCards,
  hasSubjects,
  activeSlotKey,
  slotQuery,
  onSlotQueryChange,
  onSelect,
}: {
  slotCards: SlotCard[];
  hasSubjects: boolean;
  activeSlotKey: string | null;
  slotQuery: string;
  onSlotQueryChange: (value: string) => void;
  onSelect: (card: SlotCard) => void;
}) {
  const railScrollRef = useRef<HTMLDivElement | null>(null);
  const slotByKey = useMemo(() => new Map(slotCards.map((c) => [c.key, c])), [slotCards]);
  const railGroups = useMemo(() => {
    const shortClock = (min: number): string => {
      const h24 = ((Math.floor(min / 60) % 24) + 24) % 24;
      const m = ((min % 60) + 60) % 60;
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      return `${h12}:${m.toString().padStart(2, "0")}`;
    };
    const meridiem = (min: number): string =>
      ((Math.floor(min / 60) % 24) + 24) % 24 >= 12 ? "PM" : "AM";
    const compactRange = (start: number | null, end: number | null, fallback: string | null): string => {
      if (start === null || end === null) return fallback ?? "";
      const endMeridiem = meridiem(end);
      const startMeridiem = meridiem(start) === endMeridiem ? "" : ` ${meridiem(start)}`;
      return `${shortClock(start)}${startMeridiem}–${shortClock(end)} ${endMeridiem}`;
    };
    const bySection = new Map<string, SlotCard[]>();
    for (const c of slotCards) {
      const arr = bySection.get(c.section.id) ?? [];
      arr.push(c);
      bySection.set(c.section.id, arr);
    }
    return [...bySection.values()].map((items) => ({
      label: items[0].section.name,
      children: items.map((c) => ({
        value: c.key,
        label: `${c.subject.code} · ${WEEK_LABELS_SHORT[c.day - 1]} ${compactRange(c.start, c.end, c.time)}${c.live ? " · Live" : ""}`,
        icon: <BookOpen size={16} strokeWidth={1.8} aria-hidden="true" />,
      })),
    }));
  }, [slotCards]);
  return (
    <aside className={styles.sideList} aria-label="Class sessions">
      <InputGroup className="w-full shrink-0">
        <InputGroupInput
          placeholder="Search sessions..."
          value={slotQuery}
          onChange={(event) => onSlotQueryChange(event.target.value)}
          aria-label="Search class sessions"
        />
        <InputGroupAddon>
          <Search size={16} aria-hidden />
        </InputGroupAddon>
      </InputGroup>
      <div className={styles.railScrollWrap}>
        <div ref={railScrollRef} className={styles.railScroll}>
          {slotCards.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasSubjects
                ? "No sessions match your search."
                : "No scheduled sessions yet."}
            </p>
          ) : (
            <BranchedMenu
              items={railGroups}
              defaultOpen={railGroups.map((_, i) => i)}
              defaultActive={activeSlotKey ?? ""}
              activeValue={activeSlotKey ?? ""}
              onSelect={(value) => {
                const card = slotByKey.get(value);
                if (!card) return;
                onSelect(card);
              }}
              width={248}
              indent={28}
            />
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-3 pb-1.5 pt-6">
          <ScrollDownHint
            scrollRef={railScrollRef}
            watchKey={`${slotCards.length}:${slotQuery}`}
            label="Scroll for more sessions"
            className="pointer-events-auto rounded-full border border-border bg-card px-3 py-1 shadow-sm"
          />
        </div>
      </div>
    </aside>
  );
}
