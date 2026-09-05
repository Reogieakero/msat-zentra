import { describe, it, expect } from "vitest";
import { folderNameSchema } from "../src/modules/anecdotal/anecdotal.routes.js";

describe("Anecdotal folder names", () => {
  it("accepts a normal name", () => {
    expect(folderNameSchema.parse("Bullying cases")).toBe("Bullying cases");
  });
  it("trims surrounding whitespace", () => {
    expect(folderNameSchema.parse("  Grade 7  ")).toBe("Grade 7");
  });
  it("rejects blank names", () => {
    expect(() => folderNameSchema.parse("   ")).toThrow();
  });
  it("rejects names over 60 characters", () => {
    expect(() => folderNameSchema.parse("x".repeat(61))).toThrow();
  });
});
