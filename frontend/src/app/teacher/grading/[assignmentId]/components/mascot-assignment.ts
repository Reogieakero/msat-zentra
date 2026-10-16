"use client";

import { MASCOT_CHARACTERS } from "@/components/student-mascot/StudentMascot";

/**
 * Unique mascot per student, stable across renders: hash to a preferred
 * sprite, then linear-probe to the next free one (no replacement).
 * Same input list always yields the same mapping, so read and edit views
 * never disagree on a student's sprite.
 */
export function assignUniqueMascots(
  students: { id: string; name: string; lrn: string }[],
): Map<string, string> {
  const hashSeed = (s: string): number => {
    let hash = 0;
    for (let i = 0; i < s.length; i += 1) {
      hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    }
    return hash;
  };
  const taken = new Set<number>();
  const map = new Map<string, string>();
  const ordered = [...students].sort((a, b) => a.id.localeCompare(b.id));
  for (const s of ordered) {
    let idx = hashSeed(`${s.name}:${s.lrn}`) % MASCOT_CHARACTERS.length;
    if (taken.size < MASCOT_CHARACTERS.length) {
      while (taken.has(idx)) idx = (idx + 1) % MASCOT_CHARACTERS.length;
      taken.add(idx);
    }
    map.set(s.id, MASCOT_CHARACTERS[idx]!);
  }
  return map;
}
