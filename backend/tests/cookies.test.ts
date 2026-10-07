import { describe, it, expect } from "vitest";
import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_MAX_AGE,
  clearRefreshCookie,
  getRefreshCookie,
  parseCookies,
  setRefreshCookie,
} from "../src/lib/cookies.js";

describe("refresh cookie transport", () => {
  it("sets an httpOnly, Lax, path-scoped cookie with a max age", () => {
    const headers: Record<string, string | string[]> = {};
    setRefreshCookie(
      { setHeader: (k, v) => void (headers[k] = v) },
      "tok.123",
      { secure: false },
    );
    const value = String(headers["Set-Cookie"]);
    expect(value).toContain(`${REFRESH_COOKIE_NAME}=tok.123`);
    expect(value).toContain("HttpOnly");
    expect(value).toContain("SameSite=Lax");
    expect(value).toContain("Path=/api/auth");
    expect(value).toContain(`Max-Age=${REFRESH_COOKIE_MAX_AGE}`);
    expect(value).not.toContain("Secure");
  });

  it("marks Secure in production", () => {
    const headers: Record<string, string | string[]> = {};
    setRefreshCookie(
      { setHeader: (k, v) => void (headers[k] = v) },
      "tok.123",
      { secure: true },
    );
    expect(String(headers["Set-Cookie"])).toContain("Secure");
  });

  it("clears via an expired cookie", () => {
    const headers: Record<string, string | string[]> = {};
    clearRefreshCookie({ setHeader: (k, v) => void (headers[k] = v) }, { secure: false });
    const value = String(headers["Set-Cookie"]);
    expect(value).toContain(`${REFRESH_COOKIE_NAME}=`);
    expect(value).toContain("Max-Age=0");
  });

  it("round-trips through parse + get", () => {
    const headers: Record<string, string | string[]> = {};
    setRefreshCookie(
      { setHeader: (k, v) => void (headers[k] = v) },
      "tok.123",
      { secure: false },
    );
    const sent = String(headers["Set-Cookie"]).split(";")[0];
    expect(
      getRefreshCookie({ headers: { cookie: `other=1; ${sent}` } }),
    ).toBe("tok.123");
  });

  it("returns null when the cookie is absent", () => {
    expect(getRefreshCookie({ headers: {} })).toBeNull();
    expect(parseCookies(undefined)).toEqual({});
  });
});
