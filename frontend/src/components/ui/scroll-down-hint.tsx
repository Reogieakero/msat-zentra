"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/* Scroll-down hint for scrollbar-less lists: a bouncing chevron + label.
   By default it appears only while the container actually overflows and the
   bottom isn't reached yet; pass `always` to keep it floating permanently.
   Clicking scrolls further down. Pass a `watchKey` (e.g. the list identity)
   so it re-checks when content swaps. */
export function ScrollDownHint({
  scrollRef,
  watchKey,
  label = "Scroll down",
  always = false,
  className,
}: {
  scrollRef: React.RefObject<HTMLElement | null>;
  watchKey?: unknown;
  label?: string;
  always?: boolean;
  className?: string;
}) {
  const [visible, setVisible] = React.useState(false);

  const update = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setVisible(false);
      return;
    }
    const overflowing = el.scrollHeight - el.clientHeight > 4;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setVisible(overflowing && !nearBottom);
  }, [scrollRef]);

  React.useEffect(() => {
    update();
    const el = scrollRef.current;
    el?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [scrollRef, update, watchKey]);

  if (!always && !visible) return null;

  const scrollDown = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollRef.current?.scrollBy({ top: 160, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={scrollDown}
      aria-label={`${label} — scroll list down`}
      className={cn(
        "mx-auto flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <ChevronDown size={14} className="motion-safe:animate-bounce" aria-hidden />
      {label}
    </button>
  );
}
