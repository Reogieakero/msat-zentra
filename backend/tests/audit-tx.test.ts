import { describe, it, expect, vi, beforeAll } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon";
  process.env.JWT_ACCESS_SECRET = "a";
  process.env.JWT_REFRESH_SECRET = "b";
  process.env.CACHE_ENABLED = "false";
});

function mockDb(fail?: unknown) {
  return {
    auditLog: {
      create:
        fail !== undefined
          ? vi.fn().mockRejectedValue(fail)
          : vi.fn().mockResolvedValue({ id: "log-1" }),
    },
  };
}

const input = {
  userId: "u1",
  actionType: "update",
  sourceTable: "staff_profiles",
  sourceId: "u1",
  reason: "test",
} as const;

describe("writeAudit transaction semantics", () => {
  it("writes through the provided tx client with mapped fields", async () => {
    const { writeAudit } = await import("../src/lib/audit.js");
    const db = mockDb();
    await writeAudit({ ...input }, db);
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
    const args = db.auditLog.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(args.data).toMatchObject({
      userId: "u1",
      actionType: "update",
      sourceTable: "staff_profiles",
      sourceId: "u1",
      reason: "test",
    });
  });

  it("rethrows tx-client failures so the transaction rolls back", async () => {
    const { writeAudit } = await import("../src/lib/audit.js");
    const db = mockDb(new Error("tx failed"));
    await expect(writeAudit({ ...input }, db)).rejects.toThrow("tx failed");
  });
});
