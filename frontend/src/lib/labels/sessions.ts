import { formatStatus } from "./text";
export const SESSION_KIND_OPTIONS = [
  { value: "individual", label: "One-on-one" },
  { value: "parent_conference", label: "Parent conference" },
  { value: "group", label: "Group session" },
  { value: "home_visit", label: "Home visit" },
];
export function sessionTypeLabel(value: string): string {
  switch (value) {
    case "individual":
      return "One-on-one";
    case "parent_conference":
      return "Parent conference";
    case "group":
      return "Group session";
    case "home_visit":
      return "Home visit";
    default:
      return formatStatus(value);
  }
}
export const sessionKindLabel = sessionTypeLabel;
