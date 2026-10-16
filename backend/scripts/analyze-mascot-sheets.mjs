// Generates mascot-anchors.ts: per-character, per-cell centroid offsets
// (in cell fractions, relative to the directions center cell) so the UI
// can counter-shift each sprite layer and keep the body planted while
// the head turns. Run: node scripts/analyze-mascot-sheets.mjs --emit
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, "..", "..", "frontend", "public", "mascots");

const CHARACTERS = [
  "afro", "astronaut", "bald", "ballerina", "bear", "beard", "builder",
  "bunny", "cap", "cat", "chef", "clockwork", "crt", "cube", "deer",
  "dino", "droid", "drone", "fox", "frog", "gearbot", "glasses", "grandpa",
  "granny", "hamster", "hedgehog", "hijabi", "kamran", "knight", "koala",
  "lantern", "mouse", "nurse", "otter", "owl", "panda", "penguin", "pirate",
  "postbot", "pug", "raccoon", "radio", "redpanda", "robot", "rocket",
  "scientist", "scout", "sheep", "sikh", "skater", "sloth", "tiger",
  "toaster", "tv", "wizard",
];

function readPng(file) {
  const buf = fs.readFileSync(file);
  let pos = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(`${file}: unsupported format bitDepth=${bitDepth} colorType=${colorType}`);
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const px = Buffer.alloc(width * height * channels);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    const row = raw.subarray(p, p + stride);
    p += stride;
    const out = px.subarray(y * stride, (y + 1) * stride);
    const a = (i) => (i >= channels ? out[i - channels] : 0);
    const b = (i) => (y === 0 ? 0 : px[(y - 1) * stride + i]);
    const c = (i) => (y === 0 || i < channels ? 0 : px[(y - 1) * stride + i - channels]);
    for (let i = 0; i < stride; i++) {
      let v = row[i];
      if (filter === 1) v = (v + a(i)) & 255;
      else if (filter === 2) v = (v + b(i)) & 255;
      else if (filter === 3) v = (v + ((a(i) + b(i)) >> 1)) & 255;
      else if (filter === 4) {
        const pa = Math.abs(b(i) - c(i)), pb = Math.abs(a(i) - c(i)), pc = Math.abs(a(i) + b(i) - 2 * c(i));
        const pr = pa <= pb && pa <= pc ? a(i) : pb <= pc ? b(i) : c(i);
        v = (v + pr) & 255;
      }
      out[i] = v;
    }
  }
  return { width, height, channels, px };
}

function centroid(img, cx, cy) {
  const cw = img.width / 3, ch = img.height / 3;
  const x0 = Math.floor(cx * cw), y0 = Math.floor(cy * ch);
  const x1 = Math.floor((cx + 1) * cw), y1 = Math.floor((cy + 1) * ch);
  let sx = 0, sy = 0, sa = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const a = img.channels === 4 ? img.px[(y * img.width + x) * img.channels + 3] : 255;
      if (a > 16) {
        sx += (x - x0) * a; sy += (y - y0) * a; sa += a;
      }
    }
  }
  if (!sa) return null;
  return { x: sx / sa / cw, y: sy / sa / ch };
}

const names = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const emit = process.argv.includes("--emit");
const targets = names.length ? names : CHARACTERS;

const directions = {};
const blinks = {};
let worst = { name: "", spread: 0 };
for (const name of targets) {
  const img = readPng(path.join(dir, `${name}-directions.png`));
  const cells = [];
  for (let i = 0; i < 9; i++) {
    cells.push(centroid(img, i % 3, Math.floor(i / 3)));
  }
  if (cells.some((c) => !c)) throw new Error(`${name}: empty cell`);
  const center = cells[4];
  if (!emit) {
    const xs = cells.map((c) => c.x), ys = cells.map((c) => c.y);
    const spread = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    if (spread > worst.spread) worst = { name, spread };
    console.log(`${name}: max centroid spread ${(spread * 100).toFixed(1)}% of cell`);
    continue;
  }
  directions[name] = {
    dx: cells.map((c) => +((center.x - c.x).toFixed(4))),
    dy: cells.map((c) => +((center.y - c.y).toFixed(4))),
  };
  const re = readPng(path.join(dir, `${name}-reactions.png`));
  const blink = centroid(re, 0, 0);
  if (!blink) throw new Error(`${name}: empty blink cell`);
  // Reactions cell-0 is drawn on the same 3x3 grid; normalize by its own
  // cell size so fractions stay comparable to the directions sheet.
  const rcw = re.width / 3;
  blinks[name] = {
    dx: +(((center.x * (img.width / 3)) / rcw - blink.x).toFixed(4)),
    dy: +(((center.y * (img.height / 3)) / rcw - blink.y).toFixed(4)),
  };
}

if (!emit) {
  console.log(`worst: ${worst.name} ${(worst.spread * 100).toFixed(1)}%`);
} else {
  const out = `// AUTO-GENERATED by backend/scripts/analyze-mascot-sheets.mjs --emit.
// Per-cell centroid compensation (cell fractions, relative to the
// directions center cell): translating a sprite layer by these amounts
// keeps the figure's visual mass planted while the head pose changes.
// All 55 sheets measured; values are stable unless the PNGs change.

export interface MascotAnchor {
  /** Compensation per direction cell 0..8 (row-major 3x3). */
  dx: number[];
  dy: number[];
}

export const MASCOT_DIRECTION_ANCHORS: Record<string, MascotAnchor> = ${JSON.stringify(directions)};

export const MASCOT_BLINK_ANCHORS: Record<string, { dx: number; dy: number }> = ${JSON.stringify(blinks)};
`;
  const outPath = path.join(here, "..", "..", "frontend", "src", "components", "student-mascot", "mascot-anchors.ts");
  fs.writeFileSync(outPath, out);
  console.log(`wrote ${outPath} (${Object.keys(directions).length} characters)`);
}
