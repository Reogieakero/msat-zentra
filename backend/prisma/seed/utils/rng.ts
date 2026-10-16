// Deterministic RNG (mulberry32) — same SEED produces reproducible data.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private f: () => number;
  constructor(seed: number) {
    this.f = mulberry32(seed);
  }
  next(): number {
    return this.f();
  }
  int(min: number, max: number): number {
    return Math.floor(this.f() * (max - min + 1)) + min;
  }
  float(min: number, max: number): number {
    return min + this.f() * (max - min);
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.f() * arr.length)];
  }
  /** Weighted pick: weights array parallel to values. */
  weighted<T>(values: readonly T[], weights: readonly number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.f() * total;
    for (let i = 0; i < values.length; i++) {
      r -= weights[i];
      if (r <= 0) return values[i];
    }
    return values[values.length - 1];
  }
  shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.f() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  /** Box-Muller gaussian, mean 0 sd 1. */
  gaussian(): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.f();
    while (v === 0) v = this.f();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
}

export function keyId(prefix: string, key: string): string {
  return `${prefix}_${key.replace(/[^a-zA-Z0-9]/g, "_")}`.slice(0, 60);
}

const usedLrns = new Set<string>();
export function resetLrnRegistry() {
  usedLrns.clear();
}
export function registerLrn(lrn: string) {
  usedLrns.add(lrn);
}
export function makeLrn(rng: Rng, gradeNum: string, extra: string): string {
  for (let t = 0; t < 500; t++) {
    const mid = String(rng.int(10000000, 99999999));
    const cand = `10${gradeNum}${mid}${extra}`.replace(/\D/g, "").slice(0, 12).padEnd(12, String(t % 10));
    if (!usedLrns.has(cand)) {
      usedLrns.add(cand);
      return cand;
    }
  }
  let n = 109900000000 + rng.int(0, 99999999);
  while (usedLrns.has(String(n))) n++;
  usedLrns.add(String(n));
  return String(n);
}
