"use client";
import * as React from "react";
import { SearchIcon } from "lucide-react";
import { ScrollDownHint } from "@/components/ui/scroll-down-hint";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import BranchedMenu from "@/components/nav/BranchedMenu";
import type { ClassPick } from "@/services/teacher/studentList.types";
import styles from "./student-list.module.css";
export function SectionRail({
  sectionQuery,
  onSectionQuery,
  railGroups,
  railEmpty,
  activeRailValue,
  onSelect,
}: {
  sectionQuery: string;
  onSectionQuery: (v: string) => void;
  railGroups: { label: string; children: { value: string; label: string; icon: React.ReactNode }[] }[];
  railEmpty: boolean;
  activeRailValue: string;
  onSelect: (pick: ClassPick) => void;
}) {
  const railScrollRef = React.useRef<HTMLDivElement | null>(null);
  return (
    <aside className={styles.sideCol} aria-label="Sections">
      <InputGroup className="w-full shrink-0">
        <InputGroupInput
          placeholder="Search sections..."
          value={sectionQuery}
          onChange={(event) => onSectionQuery(event.target.value)}
          aria-label="Search sections"
        />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
      </InputGroup>
      <div className={styles.railScrollWrap}>
        <div ref={railScrollRef} className={styles.railScroll}>
          {railEmpty ? (
            <p className="text-sm text-muted-foreground">
              No sections match your search.
            </p>
          ) : (
            <BranchedMenu
              items={railGroups}
              defaultOpen={[0, 1]}
              defaultActive={activeRailValue}
              activeValue={activeRailValue}
              onSelect={(value) => {
                const sep = value.indexOf(":");
                if (sep < 0) return;
                const kind = value.slice(0, sep);
                const id = value.slice(sep + 1);
                if (kind === "advisory" || kind === "class") {
                  onSelect({ kind, id } as ClassPick);
                }
              }}
              width={232}
            />
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-3 pb-1.5 pt-6">
          <ScrollDownHint
            scrollRef={railScrollRef}
            watchKey={`${railGroups.length}:${sectionQuery}`}
            label="Scroll for more sections"
            className="pointer-events-auto rounded-full border border-border bg-card px-3 py-1 shadow-sm"
          />
        </div>
      </div>
    </aside>
  );
}
