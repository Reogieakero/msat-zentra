import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractPdfImages,
  pdfHasImages,
  recognizeImageBuffers,
} from "../src/services/sf10/ocr-image.service.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(here, "..");
const DIGITAL_PDF = "C:\\Users\\jalan\\Downloads\\Copy of JHS_145516065812_Brown.xlsx.pdf";
const LOGO_PNG = path.join(backendRoot, "src", "modules", "anecdotal", "assets", "msat-logo.png");

/** Minimal PDF with one image XObject; data/pdims supplied by the test. */
function pdfWithImage(opts: {
  length: string;
  filter: string;
  width: number;
  height: number;
  data: Buffer;
}): Buffer {
  const head = `%PDF-1.4\n1 0 obj\n<< /Type /Pages /Kids [2 0 R] /Count 1 >>\nendobj\n2 0 obj\n<< /Type /Page /Parent 1 0 R /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 30 >>\nstream\nBT /F1 12 Tf (hi) Tj ET\nendstream\nendobj\n`;
  const imgHead = `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${opts.width} /Height ${opts.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter ${opts.filter} /Length ${opts.length} >>\nstream\n`;
  return Buffer.concat([
    Buffer.from(head + imgHead, "latin1"),
    opts.data,
    Buffer.from("\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n", "latin1"),
  ]);
}

describe("SF10 photo OCR plumbing (no model needed)", () => {
  it("leaves digital PDFs alone", async () => {
    const buf = fs.readFileSync(DIGITAL_PDF);
    expect(pdfHasImages(buf)).toBe(false);
    await expect(extractPdfImages(buf)).resolves.toEqual([]);
  });

  it("extracts an embedded JPEG photo (indirect Length) and skips non-JPEG", async () => {
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(21_000, 0)]);
    const pdf = pdfWithImage({
      length: "7 0 R",
      filter: "/DCTDecode",
      width: 800,
      height: 1000,
      data: jpeg,
    });
    // Indirect length lives in a value-only object, like Google exports.
    const withLen = Buffer.concat([
      pdf,
      Buffer.from(`7 0 obj\n${jpeg.length}\nendobj\n`, "latin1"),
    ]);
    const found = await extractPdfImages(withLen);
    expect(found).toHaveLength(1);
    expect(found[0].slice(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(found[0].length).toBe(jpeg.length);

    const notJpeg = pdfWithImage({
      length: `${jpeg.length}`,
      filter: "/DCTDecode",
      width: 800,
      height: 1000,
      data: Buffer.alloc(jpeg.length, 0),
    });
    await expect(extractPdfImages(notJpeg)).resolves.toEqual([]);

    const thumb = pdfWithImage({
      length: "600",
      filter: "/DCTDecode",
      width: 100,
      height: 100,
      data: Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(600, 0)]),
    });
    await expect(extractPdfImages(thumb)).resolves.toEqual([]);
  });
});

// Tesseract model download (~13MB) + WASM start; slow by design.
describe("tesseract smoke (downloads eng data once)", () => {
  it("recognizes a real PNG without crashing", async () => {
    const png = fs.readFileSync(LOGO_PNG);
    const { text, confidence } = await recognizeImageBuffers([png]);
    expect(typeof text).toBe("string");
    expect(confidence).toBeGreaterThanOrEqual(0);
    expect(confidence).toBeLessThanOrEqual(1);
  }, 180_000);
});
