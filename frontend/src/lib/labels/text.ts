export function formatStatus(value: string): string {
  const words = value.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
export function friendlyWords(value: string): string {
  const words = value.replace(/_/g, " ").trim();
  if (!words) return value;
  return words.charAt(0).toUpperCase() + words.slice(1);
}
export function humanize(value?: string | null): string {
  const words = (value ?? "").replace(/[_-]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
export function titleCase(raw: string): string {
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
export function prettifyNotificationType(raw: string | null | undefined): string {
  if (!raw) return "Notice";
  const words = raw.replace(/^generic_/, "").split("_").filter(Boolean);
  if (words.length === 0) return "Notice";
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}
export function initialsOf(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/);
  return `${(parts[0] ?? "S").charAt(0)}${(parts[1] ?? "").charAt(0)}`.toUpperCase();
}
export function formatBellDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 10);
  return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 5)}`;
}
