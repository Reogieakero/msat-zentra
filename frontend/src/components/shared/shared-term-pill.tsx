"use client";

import { Pill } from "@/components/ui/pill";

/**
 * Cross-term marker for desks that show a whole school year at once.
 *
 * Classes (and their records) belong to a school year, not a single term, so
 * switching term must not hide earlier ones. The pill says the row is shared
 * across the year; the tooltip names the term it was filed/added/granted in.
 */
export function SharedTermPill({
  termNumber,
  action = "Filed",
}: {
  termNumber?: number | null;
  action?: "Filed" | "Added" | "Granted";
}) {
  const detail = termNumber
    ? `${action} in Term ${termNumber} — shown across every term of this school year.`
    : `Shown across every term of this school year.`;
  return (
    <Pill tone="teal" label={detail} className="cursor-default">
      Shared
    </Pill>
  );
}
