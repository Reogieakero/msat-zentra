import { buildOcForm01Workbook, type OcForm01Data } from "./ocform01.workbook.js";

const SIGNATURE_MAX_BYTES = 500_000;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function parseSignatureDataUrl(dataUrl: string): Buffer {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(
    (dataUrl ?? "").trim()
  );
  if (!match) {
    throw new Error("Signature must be a PNG data URL from the signature pad.");
  }
  const buffer = Buffer.from(match[1].replace(/\s/g, ""), "base64");
  if (buffer.length === 0 || buffer.length > SIGNATURE_MAX_BYTES) {
    throw new Error("Signature image must be a non-empty PNG under 500 KB.");
  }
  if (!PNG_MAGIC.every((byte, i) => buffer[i] === byte)) {
    throw new Error("Signature image must be a valid PNG.");
  }
  return buffer;
}

export function signatureObjectPath(recordId: string): string {
  return `signatures/${recordId}-${Date.now()}.png`;
}

export async function buildOcForm01Buffer(data: OcForm01Data): Promise<Buffer> {
  const wb = await buildOcForm01Workbook(data);
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

export function ocForm01Filename(studentName: string, when: Date): string {
  const safe = studentName
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "record";
  const date = when.toISOString().slice(0, 10);
  return `OCForm-01_${safe}_${date}.xlsx`;
}

export { buildOcForm01Workbook, type OcForm01Data };
