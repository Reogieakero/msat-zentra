/** Chunked createMany with progress logging. */
export async function bulkCreate(
  label: string,
  total: number,
  // biome-ignore lint: generic batch fn
  fn: (rows: any[]) => Promise<{ count: number }>,
  rows: any[],
  chunkSize = 2000,
): Promise<number> {
  if (!rows.length) {
    console.log(`  ${label}: 0`);
    return 0;
  }
  let done = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const ch = rows.slice(i, i + chunkSize);
    try {
      const r = await fn(ch);
      done += r.count ?? ch.length;
    } catch (e: any) {
      // Fallback: insert row-by-row skipping conflicts (only for small leftovers).
      if (rows.length > 10000) throw e;
      for (const row of ch) {
        try {
          const r = await fn([row]);
          done += r.count ?? 1;
        } catch {
          /* skip duplicate */
        }
      }
    }
    if (total > 20000 && i % (chunkSize * 5) === 0) {
      console.log(`  ${label}: ${Math.min(i + chunkSize, rows.length)}/${rows.length}`);
    }
  }
  console.log(`  ${label}: ${done}`);
  return done;
}

/** Streaming flusher for very large datasets (attendance/grades). */
export class Batcher {
  rows: any[] = [];
  done = 0;
  constructor(
    private label: string,
    private chunkSize: number,
    private fn: (rows: any[]) => Promise<{ count: number }>,
  ) {}
  async push(row: any) {
    this.rows.push(row);
    if (this.rows.length >= this.chunkSize) await this.flush();
  }
  async pushMany(rows: any[]) {
    for (const r of rows) await this.push(r);
  }
  async flush() {
    if (!this.rows.length) return;
    const ch = this.rows;
    this.rows = [];
    const r = await this.fn(ch);
    this.done += r.count ?? ch.length;
  }
  async finish() {
    await this.flush();
    console.log(`  ${this.label}: ${this.done}`);
    return this.done;
  }
}
