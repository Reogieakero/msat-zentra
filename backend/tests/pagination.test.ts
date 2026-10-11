import { describe, it, expect } from "vitest";
import {
  PAGE_SIZE,
  MAX_PAGE_SIZE,
  shouldShowPagination,
  totalPagesFor,
  clampPage,
  skipFor,
  resolvePaging,
  buildPaginationMeta,
  paginated,
  paginationQuerySchema,
} from "../src/lib/pagination.js";

describe("shared pagination contract (PAGE_SIZE = 15)", () => {
  it("fixes page size at 15 with a matching ceiling", () => {
    expect(PAGE_SIZE).toBe(15);
    expect(MAX_PAGE_SIZE).toBe(15);
  });

  it("hides pagination UI at 15 or fewer records", () => {
    expect(shouldShowPagination(15)).toBe(false);
    expect(shouldShowPagination(0)).toBe(false);
    expect(shouldShowPagination(16)).toBe(true);
  });

  it("computes total pages and clamps out-of-range pages", () => {
    expect(totalPagesFor(0)).toBe(1);
    expect(totalPagesFor(15)).toBe(1);
    expect(totalPagesFor(16)).toBe(2);
    expect(totalPagesFor(112)).toBe(8);
    expect(clampPage(99, 16)).toBe(2);
    expect(clampPage(0, 16)).toBe(1);
    expect(clampPage(-3, 16)).toBe(1);
  });

  it("derives skip offsets per page", () => {
    expect(skipFor(1)).toBe(0);
    expect(skipFor(2)).toBe(15);
    expect(skipFor(3)).toBe(30);
  });

  it("clamps oversized pageSize to the 15 ceiling", () => {
    expect(resolvePaging({ page: 1, pageSize: 50 })).toEqual({ page: 1, pageSize: 15 });
    expect(resolvePaging({ page: 2 })).toEqual({ page: 2, pageSize: 15 });
    expect(resolvePaging({})).toEqual({ page: 1, pageSize: 15 });
  });

  it("returns the { data, total, page, pageSize, totalPages } envelope", () => {
    const body = paginated([1, 2, 3], 16, 2, 15);
    expect(body).toEqual({ data: [1, 2, 3], total: 16, page: 2, pageSize: 15, totalPages: 2 });
  });

  it("builds clamped pagination meta", () => {
    expect(buildPaginationMeta(9, 15, 30)).toEqual({
      page: 2,
      pageSize: 15,
      totalItems: 30,
      totalPages: 2,
    });
  });

  it("validates list query strings with zod", () => {
    const schema = paginationQuerySchema();
    expect(schema.parse({})).toMatchObject({ page: 1, pageSize: 15 });
    expect(schema.safeParse({ page: 0 }).success).toBe(false);
    expect(schema.safeParse({ pageSize: 16 }).success).toBe(false);
    expect(schema.safeParse({ q: "x".repeat(201) }).success).toBe(false);
  });
});
