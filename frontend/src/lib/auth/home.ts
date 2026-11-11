/**
 * Landing route per role after authentication. Shared by password login and
 * the Google OAuth callback so both land in the same place.
 */
export function homeForRole(role: string): string {
  switch (role) {
    case "principal":
      return "/principal/overview";
    case "registrar":
      return "/registrar/overview";
    case "record_keeper":
      return "/record-keeper/overview";
    case "guidance_counselor":
      return "/guidance/overview";
    case "nurse":
      return "/nurse/overview";
    case "adm_coordinator":
      return "/coordinator/overview";
    case "subject_teacher":
    case "adviser":
      return "/teacher/overview";
    case "student":
      return "/student";
    case "parent":
      return "/parent";
    case "admin":
      return "/admin/overview";
    default:
      return "/";
  }
}
