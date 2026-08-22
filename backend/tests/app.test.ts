import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon";
  process.env.JWT_ACCESS_SECRET = "a";
  process.env.JWT_REFRESH_SECRET = "b";
});

describe("App bootstrap", () => {
  it("mounts routes and builds an Express app", async () => {
    const { createApp } = await import("../src/app.js");
    const app = createApp();
    expect(typeof app).toBe("function");
  });
});
