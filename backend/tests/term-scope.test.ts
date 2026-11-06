import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextFunction, Request, Response } from "express";

const mocks = vi.hoisted(() => ({
  termFindUnique: vi.fn(),
  termFindMany: vi.fn(),
  schoolYearFindUnique: vi.fn(),
  schoolYearFindFirst: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    term: {
      findUnique: mocks.termFindUnique,
      findMany: mocks.termFindMany,
    },
    schoolYear: {
      findUnique: mocks.schoolYearFindUnique,
      findFirst: mocks.schoolYearFindFirst,
    },
  },
}));

vi.mock("../src/lib/jwt.js", () => ({
  verifyAccess: (token: string) => {
    if (token === "teacher-token") {
      return { sub: "teacher-1", role: "subject_teacher", type: "access" };
    }
    if (token === "principal-token") {
      return { sub: "principal-1", role: "principal", type: "access" };
    }
    throw new Error("invalid token");
  },
}));

import {
  resolveTermScope,
  scopedSchoolYearId,
  scopedTermId,
  scopedTermRow,
} from "../src/lib/termScope.js";
import { attachTermScope } from "../src/middleware/termScope.js";

const ACTIVE_YEAR = {
  id: "y-active",
  name: "SY 2026-2027",
  terms: [{ id: "server-term", termNumber: 1, startDate: null, endDate: null }],
};

function fakeReq(init: {
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
}): Request {
  return {
    query: init.query ?? {},
    headers: init.headers ?? {},
  } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.schoolYearFindFirst.mockResolvedValue(ACTIVE_YEAR);
  mocks.schoolYearFindUnique.mockResolvedValue(null);
  mocks.termFindUnique.mockResolvedValue(null);
  mocks.termFindMany.mockResolvedValue([]);
});

describe("resolveTermScope role gating", () => {
  it("ignores a client-selected term for non-teacher roles", async () => {
    const req = fakeReq({
      query: { termId: "teacher-picked-term", schoolYearId: "teacher-picked-year" },
      headers: {
        "x-term-id": "teacher-picked-term",
        "x-school-year-id": "teacher-picked-year",
      },
    });

    const scope = await resolveTermScope(req, "principal");

    expect(scope?.termId).toBe("server-term");
    expect(scope?.schoolYearId).toBe("y-active");
    expect(mocks.termFindUnique).not.toHaveBeenCalled();
    expect(mocks.schoolYearFindUnique).not.toHaveBeenCalled();
  });

  it("still honors a teacher-selected term", async () => {
    mocks.termFindUnique.mockResolvedValue({
      id: "t-picked",
      termNumber: 2,
      startDate: null,
      endDate: null,
      schoolYearId: "y-picked",
      schoolYear: { id: "y-picked", name: "SY 2025-2026" },
    });

    const scope = await resolveTermScope(
      fakeReq({ headers: { "x-term-id": "t-picked" } }),
      "subject_teacher",
    );

    expect(scope?.termId).toBe("t-picked");
    expect(scope?.schoolYearId).toBe("y-picked");
    expect(mocks.schoolYearFindFirst).not.toHaveBeenCalled();
  });

  it("honors a teacher-selected term from the query string", async () => {
    mocks.termFindUnique.mockResolvedValue({
      id: "t-query",
      termNumber: 1,
      startDate: null,
      endDate: null,
      schoolYearId: "y-query",
      schoolYear: { id: "y-query", name: "SY 2024-2025" },
    });

    const scope = await resolveTermScope(
      fakeReq({ query: { termId: "t-query" } }),
      "adviser",
    );

    expect(scope?.termId).toBe("t-query");
    expect(scope?.schoolYearId).toBe("y-query");
  });

  it("falls back to the active term when the teacher's selected term is unknown", async () => {
    const scope = await resolveTermScope(
      fakeReq({ headers: { "x-term-id": "deleted-term" } }),
      "subject_teacher",
    );

    expect(scope?.termId).toBe("server-term");
    expect(scope?.schoolYearId).toBe("y-active");
  });

  it("resolves server-side when the caller has no role (anonymous/invalid token)", async () => {
    const scope = await resolveTermScope(
      fakeReq({ headers: { "x-term-id": "teacher-picked-term" } }),
      null,
    );
    expect(scope?.termId).toBe("server-term");
    expect(mocks.termFindUnique).not.toHaveBeenCalled();
  });

  it("returns null when the active school year has no terms", async () => {
    mocks.schoolYearFindFirst.mockResolvedValue({ id: "y-empty", name: "SY", terms: [] });
    const scope = await resolveTermScope(fakeReq({}), "principal");
    expect(scope).toBeNull();
  });

  it("returns null when no active school year exists", async () => {
    mocks.schoolYearFindFirst.mockResolvedValue(null);
    const scope = await resolveTermScope(fakeReq({}), "principal");
    expect(scope).toBeNull();
  });
});

describe("scoped term helpers", () => {
  it("uses the attached request scope without touching the database", async () => {
    const req = fakeReq({});
    req.termScope = {
      schoolYearId: "y-1",
      schoolYearName: "SY 2025-2026",
      termId: "t-1",
      termNumber: 2,
      startDate: null,
      endDate: null,
    };

    const row = await scopedTermRow(req);

    expect(row).toMatchObject({
      id: "t-1",
      termNumber: 2,
      schoolYearId: "y-1",
      schoolYearName: "SY 2025-2026",
    });
    expect(scopedTermId(req)).toBe("t-1");
    expect(scopedSchoolYearId(req)).toBe("y-1");
    expect(mocks.termFindMany).not.toHaveBeenCalled();
  });

  it("falls back to the active year's current term when no scope is attached", async () => {
    mocks.termFindMany.mockResolvedValue([
      {
        id: "t-cur",
        termNumber: 1,
        startDate: null,
        endDate: null,
        schoolYearId: "y-active",
        schoolYear: { name: "SY 2026-2027" },
      },
    ]);

    const row = await scopedTermRow(fakeReq({}));

    expect(row?.id).toBe("t-cur");
    expect(row?.schoolYearName).toBe("SY 2026-2027");
  });
});

describe("attachTermScope middleware", () => {
  async function run(headers: Record<string, string>): Promise<Request> {
    const req = fakeReq({ headers });
    await new Promise<void>((resolve) => {
      void attachTermScope(req, {} as Response, (() => resolve()) as NextFunction);
    });
    return req;
  }

  it("does not leak a teacher term header into a principal request", async () => {
    const req = await run({
      authorization: "Bearer principal-token",
      "x-term-id": "teacher-picked-term",
      "x-school-year-id": "teacher-picked-year",
    });
    expect(req.termScope?.termId).toBe("server-term");
    expect(mocks.termFindUnique).not.toHaveBeenCalled();
  });

  it("honors the term header for a teacher token", async () => {
    mocks.termFindUnique.mockResolvedValue({
      id: "t-picked",
      termNumber: 3,
      startDate: null,
      endDate: null,
      schoolYearId: "y-picked",
      schoolYear: { id: "y-picked", name: "SY 2025-2026" },
    });
    const req = await run({
      authorization: "Bearer teacher-token",
      "x-term-id": "t-picked",
    });
    expect(req.termScope?.termId).toBe("t-picked");
  });

  it("falls back to the active year for an invalid token", async () => {
    const req = await run({
      authorization: "Bearer garbage",
      "x-term-id": "teacher-picked-term",
    });
    expect(req.termScope?.termId).toBe("server-term");
  });
});
