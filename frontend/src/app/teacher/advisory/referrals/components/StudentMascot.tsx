// Back-compat re-export: StudentMascot now lives in shared components so
// generic UI (e.g. RowList) can render it without importing from an app
// route. Existing imports from this path keep working.
export { StudentMascot } from "@/components/student-mascot/StudentMascot";
