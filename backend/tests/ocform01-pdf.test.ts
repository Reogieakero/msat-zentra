import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  buildOcForm01Pdf,
  ocForm01PdfFilename,
} from "../src/modules/anecdotal/ocform01.pdf.js";
import { parseSignatureDataUrl } from "../src/modules/anecdotal/ocform01.service.js";

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

const ONE_PX_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("OCForm-01 PDF twin", () => {
  it("builds a valid single-page A4 PDF", async () => {
    const bytes = await buildOcForm01Pdf(SAMPLE);
    expect(bytes.length).toBeGreaterThan(1000);
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    const [page] = pdf.getPages();
    expect(page.getWidth()).toBeCloseTo(595.28, 0);
    expect(page.getHeight()).toBeCloseTo(841.89, 0);
  });

  it("still fits one page with long narratives (fit-to-page like the xlsx)", async () => {
    const long = "The quick brown fox jumps over the lazy dog. ".repeat(40);
    const bytes = await buildOcForm01Pdf({
      ...SAMPLE,
      descriptionOfIncident: long,
      descriptionOfLocation: long,
      notesRecommendationsActions: long,
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
  });

  it("embeds the drawn signature without breaking the PDF", async () => {
    const bytes = await buildOcForm01Pdf({
      ...SAMPLE,
      signatureImage: parseSignatureDataUrl(ONE_PX_PNG),
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
  });

  it("builds a safe PDF export filename", () => {
    expect(ocForm01PdfFilename("Juan Dela Cruz", new Date("2026-09-05T02:30:00Z"))).toBe(
      "OCForm-01_Juan-Dela-Cruz_2026-09-05.pdf"
    );
  });
});
