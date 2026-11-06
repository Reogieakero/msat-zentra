import { describe, expect, it } from "vitest";
import {
  canUploadGradeLevel,
  deskForRole,
  deskForUpload,
  provisionGradeForUpload,
} from "../src/lib/roles.js";

describe("canUploadGradeLevel", () => {
  it("allows in-band grades", () => {
    expect(canUploadGradeLevel("registrar", ["G11", "G12"], "G11")).toBe(true);
    expect(canUploadGradeLevel("registrar", ["G11", "G12"], "G12")).toBe(true);
    expect(canUploadGradeLevel("record_keeper", ["G7", "G8", "G9", "G10"], "G10")).toBe(true);
  });

  it("allows anything when there is no band (principal and other roles)", () => {
    expect(canUploadGradeLevel("principal", [], "G7")).toBe(true);
    expect(canUploadGradeLevel("principal", [], "G12")).toBe(true);
  });

  it("lets the registrar upload a record topping out at G10 (JHS completer)", () => {
    expect(canUploadGradeLevel("registrar", ["G11", "G12"], "G10")).toBe(true);
  });

  it("still blocks other out-of-band grades", () => {
    expect(canUploadGradeLevel("registrar", ["G11", "G12"], "G9")).toBe(false);
    expect(canUploadGradeLevel("registrar", ["G11", "G12"], "G7")).toBe(false);
    expect(canUploadGradeLevel("record_keeper", ["G7", "G8", "G9", "G10"], "G11")).toBe(false);
    expect(canUploadGradeLevel("record_keeper", ["G7", "G8", "G9", "G10"], "G10")).toBe(true);
  });
});

describe("provisionGradeForUpload", () => {
  it("files a registrar JHS-completer upload as incoming SHS (G11)", () => {
    expect(provisionGradeForUpload("registrar", "G10")).toBe("G11");
  });

  it("leaves every other case untouched", () => {
    expect(provisionGradeForUpload("registrar", "G11")).toBe("G11");
    expect(provisionGradeForUpload("registrar", "G8")).toBe("G8");
    expect(provisionGradeForUpload("record_keeper", "G10")).toBe("G10");
    expect(provisionGradeForUpload("record_keeper", "G8")).toBe("G8");
    expect(provisionGradeForUpload("principal", "G10")).toBe("G10");
  });
});

describe("deskForRole / deskForUpload", () => {
  it("maps each desk role to its own desk, others to null", () => {
    expect(deskForRole("registrar")).toBe("registrar");
    expect(deskForRole("record_keeper")).toBe("record_keeper");
    expect(deskForRole("principal")).toBeNull();
    expect(deskForRole("adviser")).toBeNull();
  });

  it("files uploads under the uploader's own desk", () => {
    expect(deskForUpload("registrar", "G8")).toBe("registrar");
    expect(deskForUpload("registrar", "G11")).toBe("registrar");
    expect(deskForUpload("record_keeper", "G11")).toBe("record_keeper");
    expect(deskForUpload("record_keeper", "G8")).toBe("record_keeper");
  });

  it("derives the desk from the student grade for roles without a desk", () => {
    expect(deskForUpload("adviser", "G11")).toBe("registrar");
    expect(deskForUpload("adviser", "G8")).toBe("record_keeper");
  });
});
