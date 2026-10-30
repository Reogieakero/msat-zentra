/**
 * Learner-name helpers for advisory desks.
 *
 * Records are stored as typed at enlistment ("Juan Dela Cruz") but the desks
 * read surname-first ("Dela Cruz, Juan"). Names that already carry a comma
 * are treated as surname-first and re-normalised to one space after it.
 */

const SURNAME_PARTICLES = new Set([
  "de",
  "del",
  "dela",
  "delos",
  "delas",
  "da",
  "das",
  "dos",
  "la",
  "las",
  "los",
  "san",
  "santa",
  "sta",
  "sto",
  "van",
  "von",
  "der",
  "den",
  "bin",
  "binti",
  "al",
  "el",
]);

function normalizeParticle(token: string): string {
  return token.toLowerCase().replace(/\./g, "");
}

export function splitLearnerName(fullName: string): {
  surname: string;
  given: string;
} {
  const trimmed = fullName.trim().replace(/\s+/g, " ");
  if (!trimmed) return { surname: "", given: "" };

  if (trimmed.includes(",")) {
    const [surname, ...rest] = trimmed.split(",");
    return { surname: surname.trim(), given: rest.join(",").trim() };
  }

  const parts = trimmed.split(" ");
  if (parts.length === 1) return { surname: parts[0]!, given: "" };

  // Keep Filipino/foreign surname particles with the surname: "Juan Dela
  // Cruz" → surname "Dela Cruz", not "Cruz".
  let start = parts.length - 1;
  while (start > 1 && SURNAME_PARTICLES.has(normalizeParticle(parts[start - 1]!))) {
    start -= 1;
  }

  return {
    surname: parts.slice(start).join(" "),
    given: parts.slice(0, start).join(" "),
  };
}

/** "Juan Dela Cruz" → "Dela Cruz, Juan". */
export function formatSurnameFirst(fullName: string): string {
  const { surname, given } = splitLearnerName(fullName);
  if (!surname) return fullName;
  return given ? `${surname}, ${given}` : surname;
}

/** Alphabetical by surname, then given name. */
export function compareSurnameFirst(a: string, b: string): number {
  const left = splitLearnerName(a);
  const right = splitLearnerName(b);
  return (
    left.surname.localeCompare(right.surname) ||
    left.given.localeCompare(right.given)
  );
}
