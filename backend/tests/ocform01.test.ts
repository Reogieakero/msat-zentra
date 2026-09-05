import { describe, it, expect } from "vitest";
import {
  buildOcForm01Workbook,
  ocForm01Filename,
  parseSignatureDataUrl,
} from "../src/modules/anecdotal/ocform01.service.js";

const SAMPLE = {
  observerName: "Maria Adviser",
  gradeSection: "Grade 7 - Diamond",
  observationDate: "September 5, 2026",
  observationTime: "10:30 AM",
  studentName: "Juan Dela Cruz",
  descriptionOfIncident: "Student was seen pushing a classmate during recess.",
  descriptionOfLocation: "School playground near the canteen.",
  notesRecommendationsActions: "Called for a guidance conference with parents.",
  classPerformance: "Satisfactory; needs improvement in Math.",
  attendanceSummary: "Present 18/20 sessions in the last month.",
  adviserName: "Maria Adviser",
};

describe("OCForm-01 template fidelity", () => {
  it("reproduces the official sheet name, header, and title block", async () => {
    const wb = await buildOcForm01Workbook(SAMPLE);
    const ws = wb.getWorksheet("Anecdotal Report");
    expect(ws).toBeDefined();
    expect(ws!.getCell("A2").value).toBe("Republic of the Philippines");
    expect(ws!.getCell("A3").value).toBe("Department of Education");
    expect(ws!.getCell("A4").value).toBe("Region XI");
    expect(ws!.getCell("A5").value).toBe("Schools Division of the City of Mati");
    expect(ws!.getCell("A6").value).toBe("MATI SCHOOL OF ARTS AND TRADES");
    expect(ws!.getCell("A9").value).toBe("Email Add: msat.mati@deped.gov.ph");
    expect(ws!.getCell("B11").value).toBe("ANECDOTAL REPORT");
    expect(ws!.getCell("B12").value).toBe("GCForm-01");
    expect(ws!.getCell("A13").value).toBe("(Confidential)");
  });

  it("fills observer, student, datetime, and narrative fields", async () => {
    const wb = await buildOcForm01Workbook(SAMPLE);
    const ws = wb.getWorksheet("Anecdotal Report")!;
    expect(ws.getCell("D14").value).toBe("Maria Adviser");
    expect(ws.getCell("M14").value).toBe("Grade 7 - Diamond");
    expect(ws.getCell("E15").value).toBe("September 5, 2026");
    expect(ws.getCell("M15").value).toBe("10:30 AM");
    expect(ws.getCell("F16").value).toBe("Juan Dela Cruz");
    expect(ws.getCell("E17").value).toBe("Grade 7 - Diamond");
    expect(ws.getCell("B20").value).toContain("pushing a classmate");
    expect(ws.getCell("B27").value).toContain("playground");
    expect(ws.getCell("B34").value).toContain("guidance conference");
    expect(ws.getCell("F41").value).toContain("Satisfactory");
    expect(ws.getCell("J42").value).toContain("18/20");
    expect(ws.getCell("H47").value).toBe("Maria Adviser");
    expect(ws.getCell("H48").value).toBe("ADVISER'S SIGNATURE OVER PRINTED NAME");
  });

  it("keeps A4 portrait print setup, gutters, and both logos", async () => {
    const wb = await buildOcForm01Workbook(SAMPLE);
    const ws = wb.getWorksheet("Anecdotal Report")!;
    expect(ws.pageSetup.paperSize).toBe(9);
    expect(ws.pageSetup.orientation).toBe("portrait");
    expect(ws.pageSetup.fitToPage).toBe(true);
    expect(ws.pageSetup.printArea).toBe("A1:R54");
    expect(ws.pageSetup.margins.left).toBeCloseTo(0.7);
    expect(ws.getColumn(1).width).toBeCloseTo(1.5);
    expect(ws.getColumn(18).width).toBeCloseTo(1.5);
    expect(ws.getImages().length).toBe(2);
  });

  it("builds a safe export filename", () => {
    expect(ocForm01Filename("Juan Dela Cruz", new Date("2026-09-05T02:30:00Z"))).toBe(
      "OCForm-01_Juan-Dela-Cruz_2026-09-05.xlsx"
    );
  });

  it("embeds the drawn signature as a third image when signed", async () => {
    const wb = await buildOcForm01Workbook({
      ...SAMPLE,
      signatureImage: parseSignatureDataUrl(ONE_PX_PNG),
    });
    const ws = wb.getWorksheet("Anecdotal Report")!;
    expect(ws.getImages().length).toBe(3);
    expect(ws.getCell("H47").value).toBe("Maria Adviser");
  });
});

const ONE_PX_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("drawn-signature PNG validation", () => {
  it("accepts a canvas PNG data URL", () => {
    const buf = parseSignatureDataUrl(ONE_PX_PNG);
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
  });
  it("rejects non-PNG data URLs", () => {
    expect(() =>
      parseSignatureDataUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg==")
    ).toThrow();
  });
  it("rejects malformed input", () => {
    expect(() => parseSignatureDataUrl("not-a-data-url")).toThrow();
    expect(() => parseSignatureDataUrl("")).toThrow();
  });
});
