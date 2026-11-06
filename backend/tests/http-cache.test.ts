import { describe, it, expect, vi, beforeAll } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { etag, weakEtag } from "../src/lib/etag.js";
import { cache } from "../src/lib/cache.js";

beforeAll(() => {
  process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon";
  process.env.JWT_ACCESS_SECRET = "a";
  process.env.JWT_REFRESH_SECRET = "b";
  process.env.CACHE_ENABLED = "false";
});

function mockJsonRes() {
  const store: Record<string, string> = {};
  const res = {
    statusCode: 200,
    setHeader: (k: string, v: string) => {
      store[k] = v;
    },
    json: function (this: unknown) {
      return res;
    },
  } as unknown as Response;
  return { res, store };
}

describe("etag middleware", () => {
  it("sets a weak ETag on JSON responses", () => {
    const { res, store } = mockJsonRes();
    etag()({} as Request, res, (() => {}) as NextFunction);
    (res.json as (b: unknown) => unknown)({ data: [1, 2, 3], total: 3 });
    expect(store["ETag"]).toMatch(/^W\/".+"$/);
  });

  it("produces stable ETags for identical payloads", () => {
    const run = () => {
      const { res, store } = mockJsonRes();
      etag()({} as Request, res, (() => {}) as NextFunction);
      (res.json as (b: unknown) => unknown)({ data: [1], total: 1 });
      return store["ETag"];
    };
    expect(run()).toBe(run());
  });
});

describe("weakEtag helper", () => {
  it("derives the same tag the middleware emits", () => {
    const { res, store } = mockJsonRes();
    etag()({} as Request, res, (() => {}) as NextFunction);
    (res.json as (b: unknown) => unknown)({ data: [1, 2], total: 2 });
    expect(weakEtag(JSON.stringify({ data: [1, 2], total: 2 }))).toBe(store["ETag"]);
  });

  it("changes when the payload changes", () => {
    expect(weakEtag('{"a":1}')).not.toBe(weakEtag('{"a":2}'));
  });
});

describe("cache middleware headers", () => {
  it("sets Cache-Control even when redis is unavailable", async () => {
    const { res, store } = mockJsonRes();
    const next = vi.fn();
    await cache({ tags: ["audit"], ttl: 30 })({ method: "GET" } as Request, res, next as NextFunction);
    expect(next).toHaveBeenCalled();
    // no-store is deliberate: a client-side max-age served pre-write lists for up
    // to 30s after a PATCH. See the comment in lib/cache.ts.
    expect(store["Cache-Control"]).toBe("private, no-store");
  });

  it("honours a custom cacheControl option", async () => {
    const { res, store } = mockJsonRes();
    const next = vi.fn();
    await cache({ cacheControl: "private, max-age=15" })(
      { method: "GET" } as Request,
      res,
      next as NextFunction,
    );
    expect(store["Cache-Control"]).toBe("private, max-age=15");
  });
});
