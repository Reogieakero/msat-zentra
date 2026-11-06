/**
 * Student profile mascots — server twin of the referrals `StudentMascot`
 * sprite picker (`frontend/.../referrals/components/StudentMascot.tsx`).
 *
 * The character pool and hash MUST stay byte-identical to the frontend:
 * stored mascots win on read, but rows with a NULL mascot fall back to the
 * same derivation client-side, so both paths resolve to one stable mascot.
 *
 * Canonical seed: `${fullName}:${lrn}`.
 */
export const MASCOT_CHARACTERS = [
  "afro",
  "astronaut",
  "bald",
  "ballerina",
  "bear",
  "beard",
  "builder",
  "bunny",
  "cap",
  "cat",
  "chef",
  "clockwork",
  "crt",
  "cube",
  "deer",
  "dino",
  "droid",
  "drone",
  "fox",
  "frog",
  "gearbot",
  "glasses",
  "grandpa",
  "granny",
  "hamster",
  "hedgehog",
  "hijabi",
  "kamran",
  "knight",
  "koala",
  "lantern",
  "mouse",
  "nurse",
  "otter",
  "owl",
  "panda",
  "penguin",
  "pirate",
  "postbot",
  "pug",
  "raccoon",
  "radio",
  "redpanda",
  "robot",
  "rocket",
  "scientist",
  "scout",
  "sheep",
  "sikh",
  "skater",
  "sloth",
  "tiger",
  "toaster",
  "tv",
  "wizard",
] as const;

export type MascotCharacter = (typeof MASCOT_CHARACTERS)[number];

export function isMascotCharacter(value: string): value is MascotCharacter {
  return (MASCOT_CHARACTERS as readonly string[]).includes(value);
}

/** djb2-style 32-bit hash — mirrors the frontend StudentMascot picker. */
export function pickMascot(seed: string): MascotCharacter {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return MASCOT_CHARACTERS[hash % MASCOT_CHARACTERS.length]!;
}

/** Canonical mascot for a learner row. Seed matches the frontend fallback. */
export function mascotFor(fullName: string, lrn: string): MascotCharacter {
  return pickMascot(`${fullName}:${lrn}`);
}

/**
 * Collision-free mascot within a visible set (e.g. everyone displayed for
 * one section). Starts at the canonical hash pick, then probes forward
 * through the pool past every taken character. Deterministic for a given
 * (seed, taken) pair. When the set already exhausts all 55 characters,
 * reuse is unavoidable and the canonical pick is returned.
 */
export function pickUniqueMascot(
  seed: string,
  taken: ReadonlySet<string>,
): MascotCharacter {
  const first = pickMascot(seed);
  if (!taken.has(first)) return first;
  const start = MASCOT_CHARACTERS.indexOf(first);
  for (let step = 1; step < MASCOT_CHARACTERS.length; step += 1) {
    const candidate = MASCOT_CHARACTERS[(start + step) % MASCOT_CHARACTERS.length]!;
    if (!taken.has(candidate)) return candidate;
  }
  return first;
}

/** Canonical mascot for a learner row, unique within `taken`. */
export function mascotForUnique(
  fullName: string,
  lrn: string,
  taken: ReadonlySet<string>,
): MascotCharacter {
  return pickUniqueMascot(`${fullName}:${lrn}`, taken);
}

/**
 * Mascots already claimed by the learners displayed for one section:
 * registered profiles plus every roster row in the section (roster reads
 * are not year-scoped, so all years share the visible set).
 */
export async function sectionTakenMascots(
  db: {
    studentProfile: {
      findMany(args: { where: { sectionId: string }; select: { mascot: true } }): Promise<
        { mascot: string | null }[]
      >;
    };
    studentRoster: {
      findMany(args: { where: { sectionId: string }; select: { mascot: true } }): Promise<
        { mascot: string | null }[]
      >;
    };
  },
  sectionId: string,
): Promise<Set<string>> {
  const [profiles, rosterRows] = await Promise.all([
    db.studentProfile.findMany({
      where: { sectionId },
      select: { mascot: true },
    }),
    db.studentRoster.findMany({
      where: { sectionId },
      select: { mascot: true },
    }),
  ]);
  const taken = new Set<string>();
  for (const row of [...profiles, ...rosterRows]) {
    if (row.mascot) taken.add(row.mascot);
  }
  return taken;
}
