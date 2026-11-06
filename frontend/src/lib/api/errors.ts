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
