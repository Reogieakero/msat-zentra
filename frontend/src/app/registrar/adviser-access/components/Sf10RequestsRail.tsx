"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { FileStack } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sf10RequestsChart,
  countSubmittedRequests,
} from "@/components/registry/overview/Sf10RequestsChart";
import { fetchRegistrarOverview } from "@/services/registry/overview.service";
import menuStyles from "./Sf10RequestsRail.module.css";

const REQUESTS_LABEL = "SF10 Access Requests";

const MENU_PANEL =
  "absolute top-0 right-12 z-50 max-h-[calc(100dvh-6rem)] w-80 overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl ring-1 ring-border sm:w-[28rem]";

export function Sf10RequestsRail() {
  const [open, setOpen] = React.useState(false);
  const railRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (
        target?.closest?.(
          '[data-slot="popover-content"], [data-slot="tooltip-content"]',
        )
      ) {
        return;
      }
      if (railRef.current && !railRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const { data, isPending, isError } = useQuery({
    queryKey: ["registrar-overview"],
    queryFn: fetchRegistrarOverview,
    staleTime: 30_000,
  });
  const submitted = countSubmittedRequests(data?.sf10RequestsDaily);

  const tip = isError
    ? "Could not load"
    : isPending
      ? "Loading…"
      : submitted > 0
        ? `${submitted} request${submitted === 1 ? "" : "s"} in the last 30 days`
        : "No requests in the last 30 days";

  return (
    <TooltipProvider delayDuration={100}>
      <aside className="self-start lg:sticky lg:top-16" aria-label={REQUESTS_LABEL}>
        <div
          ref={railRef}
          className="flex flex-row justify-end lg:flex-col lg:items-end"
        >
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setOpen((prev) => !prev)}
                  aria-expanded={open}
                  aria-haspopup="dialog"
                  aria-label={open ? `Close ${REQUESTS_LABEL}` : `Open ${REQUESTS_LABEL}`}
                  className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                    open
                      ? "cursor-pointer border-amber-500/60 bg-amber-500/10"
                      : "cursor-pointer border-border bg-card hover:border-amber-500/60 hover:bg-amber-500/10"
                  }`}
                >
                  <span className="text-amber-500" aria-hidden>
                    <FileStack size={16} />
                  </span>
                  {!isPending && !isError && submitted > 0 ? (
                    <span
                      className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black"
                      aria-hidden="true"
                    >
                      {submitted}
                    </span>
                  ) : null}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={10}>
                <span className="font-medium">{REQUESTS_LABEL}</span>
                <span className="opacity-60">{tip}</span>
              </TooltipContent>
            </Tooltip>
            <div
              role="dialog"
              aria-label={REQUESTS_LABEL}
              aria-hidden={open ? undefined : true}
              className={`${MENU_PANEL} ${menuStyles.menu} ${
                open ? menuStyles.menuOpen : menuStyles.menuClosed
              }`}
            >
              <Sf10RequestsChart desk="registrar" className="border-0" />
            </div>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
