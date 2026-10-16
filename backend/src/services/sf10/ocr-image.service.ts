// Local OCR for scanned SF10 uploads (no external worker needed).
// - Scanned PDFs: embedded JPEG photos (DCTDecode) are pulled straight out
//   of the file — no PDF rendering needed.
// - Phone/direct photos (JPG/PNG) are recognized as-is.
// - Text comes from tesseract.js (WASM, pure npm) and flows through the
//   same line parsers as digital PDFs, so grades + learner work identically.
// Other image encodings (CCITT fax, JPEG-2000, raw pixels) are skipped and
// the record stays in needs-review.

import path from "node:path";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { logger } from "../../lib/pino.js";
import { extractRatedSubjectsFromText } from "./subject-aliases.js";
import { extractIdentityFromText, type LearnerIdentity } from "./learner-identity.service.js";

export interface OcrFileSubjects {
  subjects: Array<{
    rawName: string;
    norm: string;
    grade: number | null;
    rating: number | null;
    gradeLevel: string | null;
    quarters: Array<number | null> | null;
    remarks: string | null;
  }>;
  learner: LearnerIdentity;
  rawText: string;
  confidence: number;
}

export function isImageUpload(mimetype: string, originalname: string): boolean {
  if (mimetype === "image/jpeg" || mimetype === "image/png") return true;
  return /\.(jpe?g|png)$/i.test(originalname);
}

function isJpeg(bytes: Buffer): boolean {
  return bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

/** ASCII85 (a85) decode for `/Filter [/ASCII85Decode /DCTDecode]` streams. */
function ascii85Decode(input: string): Buffer<ArrayBuffer> {
  const clean = input.replace(/\s+/g, "").replace(/~>$/, "");
  const out: number[] = [];
  let i = 0;
  while (i < clean.length) {
    if (clean[i] === "z") {
      out.push(0, 0, 0, 0);
      i++;
      continue;
    }
    const chunk = clean.slice(i, i + 5);
    const n = chunk.length;
    if (n === 0) break;
    let value = 0;
    for (let k = 0; k < 5; k++) {
      value = value * 85 + (k < n ? clean.charCodeAt(i + k) - 33 : 84);
    }
    for (let k = 0; k < n - 1; k++) {
      out.push((value >>> (24 - k * 8)) & 0xff);
    }
    i += n;
  }
  const decoded = Buffer.allocUnsafe(out.length);
  for (let k = 0; k < out.length; k++) decoded[k] = out[k];
  return decoded;
}

/**
 * Pull embedded JPEG photos out of a PDF (scanned pages). Pure parsing —
 * DCTDecode bytes pass through untouched. Returns [] for digital PDFs.
 */
export async function extractPdfImages(buffer: Buffer): Promise<Buffer[]> {
  try {
    const latin = buffer.toString("latin1");
    if (!latin.startsWith("%PDF")) return [];
    // Indirect /Length values live in tiny value-only objects.
    const lengths = new Map<number, number>();
    for (const m of latin.matchAll(/(\d+)\s+0\s+obj\b\s*(\d+)\s*endobj/g)) {
      lengths.set(Number(m[1]), Number(m[2]));
    }
    const images: Buffer[] = [];
    const objRe = /(\d+)\s+0\s+obj\b\s*<<([\s\S]*?)>>\s*stream\r?\n/g;
    let m: RegExpExecArray | null;
    while ((m = objRe.exec(latin)) !== null) {
      const header = m[2];
      if (!/\/Subtype\s*\/?Image/.test(header)) continue;
      if (!/\/DCTDecode/.test(header)) continue;
      const dataStart = m.index + m[0].length;
      const lenRef = header.match(/\/Length\s+(\d+)\s+0\s+R/);
      const direct = header.match(/\/Length\s+(\d+)/);
      let dataEnd: number;
      if (lenRef && lengths.has(Number(lenRef[1]))) {
        dataEnd = dataStart + (lengths.get(Number(lenRef[1])) as number);
      } else if (direct && !/\/Length\s+\d+\s+0\s+R/.test(header)) {
        dataEnd = dataStart + Number(direct[1]);
      } else {
        const es = latin.indexOf("endstream", dataStart);
        dataEnd = es < 0 ? dataStart : es;
      }
      let data: Buffer<ArrayBuffer> = Buffer.from(latin.slice(dataStart, dataEnd), "latin1");
      if (/\/ASCII85Decode/.test(header)) {
        try {
          data = ascii85Decode(data.toString("latin1"));
        } catch {
          continue;
        }
      }
      if (!isJpeg(data)) continue;
      // Skip thumbnails/icons: scanned pages are large.
      const w = header.match(/\/Width\s+(\d+)/);
      const h = header.match(/\/Height\s+(\d+)/);
      if (w && h && (Number(w[1]) < 400 || Number(h[1]) < 400)) continue;
      if (data.length < 20_000) continue;
      images.push(data);
      if (images.length >= 12) break;
    }
    return images;
  } catch (e) {
    logger.warn({ err: e }, "[sf10-ocr] pdf image extraction failed");
    return [];
  }
}

/** Cheap check (no inflate): does this PDF carry any image XObjects? */
export function pdfHasImages(buffer: Buffer): boolean {
  try {
    const latin = buffer.toString("latin1").slice(0, 400_000);
    return /\/Subtype\s*\/?Image/.test(latin);
  } catch {
    return false;
  }
}

const backendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

type TessWorker = {
  recognize: (image: Buffer) => Promise<{ data: { text: string; confidence: number } }>;
  terminate: () => Promise<void>;
};

let worker: TessWorker | null = null;
let workerFailed = false;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
// Serialize OCR jobs: one WASM worker, one job at a time.
let tail: Promise<unknown> = Promise.resolve();

function pokeIdle() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    void (async () => {
      const w = worker;
      worker = null;
      try {
        await w?.terminate();
      } catch {
        // Terminating an idle worker is best-effort.
      }
    })();
  }, 5 * 60_000);
  if (idleTimer.unref) idleTimer.unref();
}

async function getWorker(): Promise<TessWorker> {
  if (worker) {
    pokeIdle();
    return worker;
  }
  if (workerFailed) throw new Error("tesseract worker unavailable (a previous start failed)");
  const { createWorker } = (await import("tesseract.js")) as typeof import("tesseract.js");
  const cachePath = path.join(backendRoot, ".tesseract-cache");
  await mkdir(cachePath, { recursive: true });
  const w = (await createWorker("eng", undefined, {
    cachePath,
    logger: () => {},
  } as never)) as unknown as TessWorker;
  worker = w;
  workerFailed = false;
  pokeIdle();
  return w;
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn);
  tail = run.catch(() => {});
  return run as Promise<T>;
}

/** Recognize photo buffers to text (sequential, shared worker). */
export async function recognizeImageBuffers(buffers: Buffer[]): Promise<{ text: string; confidence: number }> {
  return enqueue(async () => {
    let w: TessWorker;
    try {
      w = await getWorker();
    } catch (e) {
      workerFailed = true;
      worker = null;
      throw e;
    }
    const pages: string[] = [];
    let confSum = 0;
    let confN = 0;
    for (const buf of buffers) {
      let data: { text: string; confidence: number };
      try {
        ({ data } = await w.recognize(buf));
      } catch (e) {
        try {
          await w.terminate();
        } catch {
          // Resetting a broken worker is best-effort.
        }
        worker = null;
        throw e;
      }
      pages.push(data.text ?? "");
      if (Number.isFinite(data.confidence)) {
        confSum += data.confidence;
        confN++;
      }
    }
    return {
      text: pages.join("\n").slice(0, 20_000),
      confidence: confN > 0 ? Math.max(0, Math.min(1, confSum / confN / 100)) : 0,
    };
  });
}

/**
 * Full photo path: images → OCR text → subjects + learner via the same
 * parsers digital PDFs use. Returns null when the file holds no photos.
 */
export async function ocrFileToSubjects(file: {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}): Promise<OcrFileSubjects | null> {
  const images = isImageUpload(file.mimetype, file.originalname)
    ? [file.buffer]
    : await extractPdfImages(file.buffer);
  if (images.length === 0) return null;
  logger.info({ pages: images.length }, "[sf10-ocr] local photo OCR started");
  const { text: rawText, confidence } = await recognizeImageBuffers(images);
  const { extractRatedSubjectsFromText } = await import("./subject-aliases.js");
  const subjects = extractRatedSubjectsFromText(rawText).map((s) => ({
    rawName: s.rawName,
    norm: s.norm,
    grade: s.rating,
    rating: s.rating,
    gradeLevel: s.gradeLevel,
    quarters: s.quarters,
    remarks: s.remarks,
  }));
  const learner = extractIdentityFromText(rawText);
  logger.info(
    { pages: images.length, subjects: subjects.length, confidence },
    "[sf10-ocr] local photo OCR finished",
  );
  return { subjects, learner, rawText, confidence };
}
