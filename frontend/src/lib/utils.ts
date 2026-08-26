import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Normalize a section label into a single canonical form: "Grade 7-A".
// Accepts the stored DB form ("7-A"), the attendance API form ("Grade 7-A"),
// or a grade-only form ("Grade 7") so every surface renders section names
// identically. Null/empty input is passed through unchanged.
export function formatSection(raw: string | null | undefined): string {
  if (!raw) return raw ?? "";
  // Strip any existing "Grade " prefix, then split into grade + optional letter.
  const cleaned = raw.replace(/^Grade\s+/i, "");
  const match = cleaned.match(/^(\d{1,2})(?:[-–\s]*([A-Za-z0-9]+))?$/);
  if (!match) return raw;
  const grade = match[1];
  const letter = match[2];
  return letter ? `Grade ${grade}-${letter.toUpperCase()}` : `Grade ${grade}`;
}

// Short form for the records heatmap: "Section A" (drops the grade prefix).
// Accepts the same inputs as formatSection.
export function formatSectionShort(raw: string | null | undefined): string {
  if (!raw) return raw ?? "";
  const cleaned = raw.replace(/^Grade\s+/i, "");
  const match = cleaned.match(/^(\d{1,2})(?:[-–\s]*([A-Za-z0-9]+))?$/);
  if (!match) return raw;
  const letter = match[2];
  return letter ? `Section ${letter.toUpperCase()}` : raw;
}
