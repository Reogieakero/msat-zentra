"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { scrollToSection, type SettingsSectionLink } from "./SettingsNav";

/* Right icon rail for nurse settings — same gutter language as the
   attendance sidebar: 36px icon buttons, amber active/hover, tooltip
   naming each section. Vertical + sticky on desktop, horizontal row
   on small screens. Mirrors the teacher/record-keeper settings rail. */
export function SettingsRail({
  links,
  activeId,
  onSelect,
}: {
  links: SettingsSectionLink[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <aside aria-label="Settings sections" className="min-w-0 self-start lg:sticky lg:top-16">
      <TooltipProvider delayDuration={100}>
        <div className="flex flex-row justify-start gap-2 lg:flex-col lg:items-end">
          {links.map((l) => {
            const active = l.id === activeId;
            const { Icon } = l;
            return (
              <Tooltip key={l.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(l.id);
                      scrollToSection(l.id);
                    }}
                    aria-current={active || undefined}
                    aria-label={`Go to ${l.label}`}
                    className={cn(
                      "relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border transition-colors",
                      active
                        ? "border-amber-500/60 bg-amber-500/10"
                        : "border-border bg-card hover:border-amber-500/60 hover:bg-amber-500/10",
                    )}
                  >
                    <span className="text-amber-500" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    {active ? (
                      <span
                        className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-card"
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" sideOffset={10}>
                  {l.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </aside>
  );
}
