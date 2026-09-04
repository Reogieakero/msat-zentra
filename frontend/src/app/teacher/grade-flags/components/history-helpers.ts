export function initialsOfTeacher(name: string): string {
  const initials = name
    .split(" ")
    .filter((p) => /^[A-Za-z]/.test(p))
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return initials || "?";
}
