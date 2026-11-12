/**
 * Compose a display name with an optional name extension (Jr., Sr., II, …).
 * `User.fullName` is a single column, so the extension is appended rather than
 * stored separately — and it is not duplicated if the user already typed it.
 */
export function withNameSuffix(fullName: string, suffix?: string | null): string {
  const name = fullName.trim().replace(/\s+/g, " ");
  const raw = suffix?.trim();
  if (!raw) return name;

  const bare = raw.replace(/\.+$/, "").toLowerCase();
  const canonical =
    bare === "jr"
      ? "Jr."
      : bare === "sr"
        ? "Sr."
        : ["ii", "iii", "iv", "v"].includes(bare)
          ? bare.toUpperCase()
          : raw;

  const lowerName = name.toLowerCase();
  if (lowerName.endsWith(raw.toLowerCase()) || lowerName.endsWith(bare)) return name;
  return `${name} ${canonical}`;
}
