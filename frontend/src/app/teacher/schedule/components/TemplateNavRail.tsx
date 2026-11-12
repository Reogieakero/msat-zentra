"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookPlus, LayoutGrid, Search, Send, SlidersHorizontal, UserPlus } from "lucide-react";

export type TemplateView = "grid" | "subjects" | "teachers" | "config" | "send";

interface Props {
  view: TemplateView;
  onSelect: (next: TemplateView) => void;
}

const ITEM =
  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground motion-reduce:transition-none";
const ITEM_ACTIVE = "bg-amber-500/10 font-medium text-foreground";
const ICON_ACTIVE = "text-amber-500";

/**
 * Left nav for /teacher/schedule/template. A find-as-you-type search sits on top
 * (press F to focus), then flat action links — one panel at a time, the active
 * link is marked so the panel on the right is never a mystery.
 */
export function TemplateNavRail({ view, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "f" && e.key !== "F") return;
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable === true;
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const actions: ReadonlyArray<{ label: string; Icon: typeof Search; value: TemplateView }> = [
    { label: "Timetable", Icon: LayoutGrid, value: "grid" },
    { label: "Subjects", Icon: BookPlus, value: "subjects" },
    { label: "Teachers", Icon: UserPlus, value: "teachers" },
    { label: "Configure", Icon: SlidersHorizontal, value: "config" },
    { label: "Send to principal", Icon: Send, value: "send" },
  ];
  const shown = actions.filter(
    (a) => !query.trim() || a.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="hidden w-52 shrink-0 lg:-mt-4 lg:-mb-4 lg:-ml-4 lg:block lg:min-h-[calc(100dvh-3rem)] lg:w-56 lg:border-r lg:border-solid lg:border-border lg:bg-linear-to-b lg:from-muted/40 lg:via-muted/10 lg:to-transparent lg:pt-4 lg:pr-4 lg:pl-4">
      <aside
        aria-label="Template navigation"
        className="sticky top-16 flex max-h-[calc(100dvh-5rem)] flex-col gap-2 overflow-y-auto"
      >
        <Link
          href="/teacher/schedule"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden />
          Back to schedule
        </Link>
        <div className="relative">
          <Search
            size={14}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find"
            aria-label="Find a template action"
            className="h-8 w-full rounded-md border bg-card pr-7 pl-7 text-xs outline-none transition-colors duration-150 placeholder:text-muted-foreground focus:border-amber-500/60"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 rounded border bg-muted px-1 text-[10px] leading-4 text-muted-foreground">
            F
          </kbd>
        </div>

        <nav aria-label="Template actions" className="flex flex-col gap-0.5">
          {shown.length > 0 ? (
            shown.map((a) => {
              const active = view === a.value;
              return (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => onSelect(a.value)}
                  aria-current={active ? "page" : undefined}
                  className={`${ITEM} text-left ${active ? ITEM_ACTIVE : ""}`}
                >
                  <a.Icon
                    size={15}
                    aria-hidden
                    className={`shrink-0 ${active ? ICON_ACTIVE : ""}`}
                  />
                  <span className="truncate">{a.label}</span>
                </button>
              );
            })
          ) : (
            <p className="px-2 py-1 text-xs text-muted-foreground">No matches.</p>
          )}
        </nav>
      </aside>
    </div>
  );
}
