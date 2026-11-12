import { Fragment } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { WEEK_LABELS_SHORT } from "@/services/teacher/schedule";

/*
 * Loading shell for the section schedule review desk. Mirrors the real page
 * (icon row at the top right → back link → section card → read-only grid) so
 * the swap to live data does not shift anything on screen. Row rhythm comes
 * from the default day config: 8 periods with lunch after the 4th.
 */

const DAYS = [1, 2, 3, 4, 5];
const PERIODS = 8;
const LUNCH_AFTER = 4;

function CellSkeleton() {
  return (
    <td className="border-t p-1">
      <div className="flex min-h-14 w-full items-center justify-center rounded-md border border-solid bg-primary/5 px-1 py-1">
        <span className="flex w-full min-w-0 flex-col items-center gap-1 leading-tight">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-2.5 w-1/2" />
        </span>
      </div>
    </td>
  );
}

function BreakRow() {
  return (
    <tr>
      <td
        colSpan={DAYS.length + 1}
        className="border-t bg-muted/40 px-2 py-1 text-center text-xs text-muted-foreground"
      >
        <Skeleton className="mx-auto h-3 w-44" />
      </td>
    </tr>
  );
}

export function SectionScheduleSkeleton() {
  return (
    <section className="flex w-full flex-col gap-5" aria-busy="true" aria-label="Loading schedule">
      <div className="flex min-w-0 items-center justify-between gap-2" aria-hidden="true">
        <Skeleton className="-ml-2 h-6 w-32 rounded-md" />
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-8 rounded-xl" />
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20">
          <div className="-mx-2.5 flex items-center justify-between gap-2 border-b border-border px-3.5 pb-2">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-3.5 w-3.5 rounded-sm" />
              <Skeleton className="h-3.5 w-28" />
            </div>
            <Skeleton className="h-[18px] w-20 rounded-md" />
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm dark:bg-card">
            <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
            <div className="flex flex-wrap items-center gap-1.5">
              {["w-20", "w-28", "w-16"].map((w) => (
                <Skeleton key={w} className={`h-[18px] rounded-md ${w}`} />
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr>
                <th scope="col" className="w-28 p-2 text-left">
                  <span className="sr-only">Time</span>
                </th>
                {DAYS.map((day) => (
                  <th key={day} scope="col" className="p-2 text-center">
                    <Skeleton className="mx-auto h-3 w-8" aria-hidden />
                    <span className="sr-only">{WEEK_LABELS_SHORT[day - 1]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: PERIODS }).map((_, i) => (
                <Fragment key={`period-${i}`}>
                  <tr>
                    <th scope="row" className="border-t p-2 text-left">
                      <Skeleton className="h-3 w-24" />
                    </th>
                    {DAYS.map((day) => (
                      <CellSkeleton key={day} />
                    ))}
                  </tr>
                  {i + 1 === LUNCH_AFTER ? <BreakRow /> : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
