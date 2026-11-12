import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

beforeAll(() => {
  process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon";
  process.env.JWT_ACCESS_SECRET = "a";
  process.env.JWT_REFRESH_SECRET = "b";
  process.env.CONTACT_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

const { encryptContact, decryptContact, isEncryptedContact } = await import(
  "../src/lib/contact-crypto.js"
);

describe("contact number encryption", () => {
  it("round-trips a Philippine mobile number", () => {
    const ciphertext = encryptContact("09171234567");
    expect(ciphertext).toMatch(/^v1:/);
    expect(ciphertext).not.toContain("09171234567");
    expect(decryptContact(ciphertext)).toBe("09171234567");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptContact("09171234567");
    const b = encryptContact("09171234567");
    expect(a).not.toBe(b);
    expect(decryptContact(a)).toBe(decryptContact(b));
  });

  it("keeps empty values null", () => {
    expect(encryptContact(null)).toBeNull();
    expect(encryptContact("")).toBeNull();
    expect(encryptContact("   ")).toBeNull();
    expect(decryptContact(null)).toBeNull();
  });

  it("reads legacy plaintext rows without a marker", () => {
    expect(isEncryptedContact("09171234567")).toBe(false);
    expect(decryptContact("09171234567")).toBe("09171234567");
  });

  it("rejects tampered ciphertext instead of returning garbage", () => {
    const ciphertext = encryptContact("09171234567")!;
    const parts = ciphertext.split(":");
    const tampered = [parts[0], parts[1], parts[2], Buffer.from("nope").toString("base64")].join(":");
    expect(decryptContact(tampered)).toBeNull();
  });
});
