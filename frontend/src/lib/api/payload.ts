// Shared payload-shape guards for service fetchers. Backend list
// endpoints have served bare arrays, `{rows}`, `{data}`, `{referrals}`,
// and paginated envelopes across their history — these helpers normalize
// every shape to a plain array so callers never branch on payload shape.
// Key order is caller-specified and preserved exactly (first array wins).
/** Bare payload if it is an array, otherwise `[]`. */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** First array found: the bare payload, then each named envelope key in
 *  the given order, otherwise `[]`. Non-object payloads yield `[]`. */
export function pickList<T>(data: unknown, ...keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[];
  if (typeof data === "object" && data !== null) {
    const record = data as Record<string, unknown>;
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) return value as T[];
    }
  }
  return [];
}
