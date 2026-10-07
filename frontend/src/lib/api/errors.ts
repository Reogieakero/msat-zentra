// Single home for backend-error text extraction. Merged from the four
// identical copies that lived in the coordinator / guidance / nurse /
// principal data modules.
//
// Two historical call shapes are preserved exactly, distinguished by the
// `fallback` argument:
// - `apiErrorMessage(err)` (coordinator style): server `{ message }`,
//   then the raw Error message, then a generic default.
// - `apiErrorMessage(err, fallback)` (guidance/nurse/principal style):
//   server `{ error: { message } }`, otherwise `fallback` verbatim —
//   never the raw Error text, so offline/network failures still read as
//   the action-specific notice ("Could not book the session…").
export function apiErrorMessage(err: unknown, fallback?: string): string {
  if (fallback !== undefined) {
    if (typeof err === "object" && err !== null && "response" in err) {
      const data = (
        err as { response?: { data?: { error?: { message?: string } } } }
      ).response?.data;
      if (data?.error?.message) return data.error.message;
    }
    return fallback;
  }
  if (typeof err === "object" && err !== null) {
    const data = (err as { response?: { data?: { message?: string } } })
      .response?.data;
    if (data?.message) return data.message;
    if (err instanceof Error) return err.message;
  }
  return "Something went wrong. Please try again.";
}
