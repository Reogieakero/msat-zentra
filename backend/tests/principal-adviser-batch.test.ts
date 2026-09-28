import { describe, it, expect } from "vitest";
import { MAX_ADVISER_BATCH, normalizeAdviserBatch } from "../src/modules/academics/adviserBatch.js";
import { AppError } from "../src/lib/errors.js";

function errOf(fn: () => unknown): AppError {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    return e as AppError;
  }
  throw new Error("expected AppError, got success");
}

describe("Principal advisory batch normalization", () => {
  it("rejects a missing/empty assignments array", () => {
    expect(errOf(() => normalizeAdviserBatch(undefined)).status).toBe(400);
    expect(errOf(() => normalizeAdviserBatch([])).status).toBe(400);
    expect(errOf(() => normalizeAdviserBatch("nope")).status).toBe(400);
  });

  it("rejects batches over the cap", () => {
    const rows = Array.from({ length: MAX_ADVISER_BATCH + 1 }, (_, i) => ({
      sectionId: `sec-${i}`,
      adviserId: "t-1",
    }));
    const err = errOf(() => normalizeAdviserBatch(rows));
    expect(err.status).toBe(400);
    expect(err.code).toBe("BATCH_TOO_LARGE");
  });

  it("rejects rows with neither section id nor name", () => {
    const err = errOf(() => normalizeAdviserBatch([{ adviserId: "t-1" }]));
    expect(err.status).toBe(400);
  });

  it("rejects name-based rows with a bad grade", () => {
    expect(errOf(() => normalizeAdviserBatch([{ sectionName: "Macopa" }])).code).toBe(
      "INVALID_GRADE_LEVEL"
    );
    expect(
      errOf(() => normalizeAdviserBatch([{ sectionName: "Macopa", gradeLevel: 13 }])).code
    ).toBe("INVALID_GRADE_LEVEL");
  });

  it("trims ids and maps empty adviser refs to null (clear)", () => {
    expect(normalizeAdviserBatch([{ sectionId: "  sec-1 ", adviserId: "  t-1 " }])).toEqual([
      { sectionId: "sec-1", sectionName: null, gradeLevel: null, adviserId: "t-1", adviserName: null },
    ]);
    expect(normalizeAdviserBatch([{ sectionId: "sec-1", adviserId: "   " }])).toEqual([
      { sectionId: "sec-1", sectionName: null, gradeLevel: null, adviserId: null, adviserName: null },
    ]);
  });

  it("passes name-based rows through for server-side resolution", () => {
    expect(
      normalizeAdviserBatch([{ sectionName: "  Macopa ", gradeLevel: 7, adviserName: " Juan " }])
    ).toEqual([
      {
        sectionId: null,
        sectionName: "Macopa",
        gradeLevel: 7,
        adviserId: null,
        adviserName: "Juan",
      },
    ]);
  });

  it("dedupes by section with last entry winning (ids and names)", () => {
    expect(
      normalizeAdviserBatch([
        { sectionId: "sec-1", adviserId: "t-1" },
        { sectionId: "sec-2", adviserId: "t-2" },
        { sectionId: "sec-1", adviserId: "t-3" },
      ]).map((r) => [r.sectionId, r.adviserId])
    ).toEqual([
      ["sec-1", "t-3"],
      ["sec-2", "t-2"],
    ]);
    expect(
      normalizeAdviserBatch([
        { sectionName: "Macopa", gradeLevel: 7, adviserName: "A" },
        { sectionName: "macopa", gradeLevel: 7, adviserName: "B" },
      ])
    ).toEqual([
      {
        sectionId: null,
        sectionName: "macopa",
        gradeLevel: 7,
        adviserId: null,
        adviserName: "B",
      },
    ]);
  });
});
