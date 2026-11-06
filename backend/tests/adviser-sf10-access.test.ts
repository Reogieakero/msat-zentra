import { describe, it, expect } from "vitest";
import { normalizePicks, partitionVerification } from "../src/services/advisory/sf10-access.service.js";

describe("Adviser SF10 verification partition (LRN has/missing)", () => {
  it("splits matched rows into has vs missing", () => {
    const rows = [
      { lrn: "1001", record: { id: "r1" } },
      { lrn: "1002", record: null },
      { lrn: "1003", record: { id: "r3" } },
      { lrn: "1004", record: null },
    ];
    expect(partitionVerification(rows)).toEqual({ has: 2, missing: 2, total: 4 });
  });

  it("handles all-missing (roster-only) and all-has", () => {
    expect(partitionVerification([{ lrn: "1", record: null }])).toEqual({
      has: 0,
      missing: 1,
      total: 1,
    });
    expect(partitionVerification([])).toEqual({ has: 0, missing: 0, total: 0 });
  });
});

describe("Adviser SF10 checkbox picks", () => {
  it("trims, drops empties, and dedupes", () => {
    expect(normalizePicks([" 1001 ", "1001", "", "  ", "1002"])).toEqual(["1001", "1002"]);
  });

  it("defaults to empty (whole section) and caps at 200", () => {
    expect(normalizePicks(undefined)).toEqual([]);
    const many = Array.from({ length: 250 }, (_, i) => `LRN${i}`);
    expect(normalizePicks(many)).toHaveLength(200);
  });
});
