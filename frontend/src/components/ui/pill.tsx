"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type PillTone = "neutral" | "amber" | "red" | "green" | "blue" | "violet";

const TONES: Record<PillTone, string> = {
  /* Plain grey chip — identity values such as LRN / section name. */
  neutral: "bg-muted text-foreground",
  amber: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
  red: "bg-red-500/20 text-red-700 dark:text-red-400",
  green: "bg-green-500/20 text-green-700 dark:text-green-400",
  blue: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  violet: "bg-violet-500/20 text-violet-700 dark:text-violet-400",
};

/**
 * Shared rectangle pill used for compact metadata (LRN, section, risk level,
 * session kind, …). One shape + one palette everywhere so desk cards, dialogs
 * and boards read the same; `tone` only changes the colour family.
 *
 * Pass `label` to get the standard hover/focus tooltip that names the field
 * (label only — the value is already on the pill).
 */
export function Pill({
  tone = "neutral",
  className,
  title,
  label,
  children,
  ...rest
}: {
  tone?: PillTone;
  className?: string;
  title?: string;
  /** Field name shown in the pill's tooltip (e.g. "LRN", "Section"). */
  label?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, "title" | "className" | "children">) {
  const pill = (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold",
        TONES[tone],
        className
      )}
      title={title}
      aria-label={label}
      {...rest}
    >
      {children}
    </span>
  );

  if (!label) return pill;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>{pill}</TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          <span className="font-medium">{label}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
