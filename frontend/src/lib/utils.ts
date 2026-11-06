import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatSection(raw: string | null | undefined): string {
  if (!raw) return raw ?? "";

  const cleaned = raw.replace(/^Grade\s+/i, "");
  const match = cleaned.match(/^(\d{1,2})(?:[-–\s]*([A-Za-z0-9]+))?$/);
  if (!match) return raw;
  const grade = match[1];
  const letter = match[2];
  return letter ? `Grade ${grade}-${letter.toUpperCase()}` : `Grade ${grade}`;
}

export function formatSectionShort(raw: string | null | undefined): string {
  if (!raw) return raw ?? "";
  const cleaned = raw.replace(/^Grade\s+/i, "");
  const match = cleaned.match(/^(\d{1,2})(?:[-–\s]*([A-Za-z0-9]+))?$/);
  if (!match) return raw;
  const letter = match[2];
  return letter ? `Section ${letter.toUpperCase()}` : raw;
}

export function formatGrade(raw: string | null | undefined): string {
  if (!raw) return raw ?? "";
  const match = raw.match(/^G?(\d{1,2})$/i);
  if (match) return `Grade ${match[1]}`;
  return raw;
}

export function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
