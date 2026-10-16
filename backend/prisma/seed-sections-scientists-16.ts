import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";
import { Rng, keyId, makeLrn, registerLrn, resetLrnRegistry } from "./seed/utils/rng.js";
import { buildNamesForGenders } from "./data/filipino-names.js";
import { randomInt } from "node:crypto";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
const DRY = process.argv.includes("--dry-run");
const PER_SECTION = 16;
const SY_NAME = "SY 2026-2027";
const SEED = Number(process.env.SEED ?? 20261014) || 20261014;

// 2 per grade level, scientist/inventor display names only (no grade prefix).
// gradeLevel column still set correctly; adviserLabel is free-text (no account).
const SECTION_DEFS: { gradeLevel: "G7" | "G8" | "G9" | "G10" | "G11" | "G12"; name: string }[] = [
  { gradeLevel: "G7", name: "Einstein" },
  { gradeLevel: "G7", name: "Newton" },
  { gradeLevel: "G8", name: "Curie" },
  { gradeLevel: "G8", name: "Tesla" },
  { gradeLevel: "G9", name: "Darwin" },
  { gradeLevel: "G9", name: "Galileo" },
  { gradeLevel: "G10", name: "Edison" },
  { gradeLevel: "G10", name: "Franklin" },
  { gradeLevel: "G11", name: "Mendel" },
  { gradeLevel: "G11", name: "Pasteur" },
  { gradeLevel: "G12", name: "Archimedes" },
  { gradeLevel: "G12", name: "Aristotle" },
];

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function mintAdviserCode(): string {
  let suffix = "";
  for (let i = 0; i < 5; i += 1) suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `ADV-${suffix}`;
}

async function mintUniqueAdviserCode(exclude: Set<string>): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const cand = mintAdviserCode();
    if (exclude.has(cand)) continue;
    const clash = await prisma.section.findUnique({ where: { adviserCode: cand }, select: { id: true } });
    if (!clash) {
      exclude.add(cand);
      return cand;
    }
  }
  throw new Error("Could not mint a unique advisory code");
}

async function main() {
  const sy = await prisma.schoolYear.findFirst({ where: { name: SY_NAME }, select: { id: true, name: true } });
  if (!sy) throw new Error(`School year "${SY_NAME}" not found — seed it first`);
  console.log(`Target: ${sy.name} (${sy.id}) DRY=${DRY}`);

  resetLrnRegistry();
  const existingLrns = await prisma.studentRoster.findMany({ select: { lrn: true } });
  for (const e of existingLrns) registerLrn(e.lrn);
  const existingProfiles = await prisma.studentProfile.findMany({ select: { lrn: true } });
  for (const e of existingProfiles) registerLrn(e.lrn);

  const excludeCodes = new Set<string>(
    (await prisma.section.findMany({ where: { adviserCode: { not: null } }, select: { adviserCode: true } }))
      .map((s) => s.adviserCode)
      .filter((c): c is string => !!c),
  );

  const rng = new Rng(SEED);

  // Pre-generate names for worst case (all 192 new).
  const maxNew = SECTION_DEFS.length * PER_SECTION;
  const genders: ("Male" | "Female")[] = Array.from({ length: maxNew }, (_, i) => (i % 2 === 0 ? "Female" : "Male"));
  const names = buildNamesForGenders(genders);
  let nameIdx = 0;

  console.log("section,grade,have,add,total,adviserLabel,adviserCode,note");
  let sectionsCreated = 0;
  let rosterAdded = 0;

  for (const def of SECTION_DEFS) {
    const adviserLabel = `Adviser ${def.name}`;
    let section = await prisma.section.findFirst({
      where: { schoolYearId: sy.id, name: def.name },
      select: { id: true, name: true, gradeLevel: true, adviserId: true, adviserLabel: true, adviserCode: true },
    });

    let note = "";
    if (!section) {
      const code = await mintUniqueAdviserCode(excludeCodes);
      note = "created";
      if (!DRY) {
        section = await prisma.section.create({
          data: {
            id: keyId("sec", `${sy.id}_${def.name}`),
            name: def.name,
            gradeLevel: def.gradeLevel as never,
            schoolYearId: sy.id,
            adviserId: null,
            adviserLabel,
            adviserCode: code,
          },
          select: { id: true, name: true, gradeLevel: true, adviserId: true, adviserLabel: true, adviserCode: true },
        });
        sectionsCreated++;
      } else {
        section = { id: "(dry)", name: def.name, gradeLevel: def.gradeLevel, adviserId: null, adviserLabel, adviserCode: code } as never;
      }
    } else {
      // Keep existing; never clear a claimed adviserId. Fill label/code only when unclaimed + missing.
      if (section.adviserId) {
        note = "kept (claimed)";
      } else if (!section.adviserLabel || !section.adviserCode) {
        const code = section.adviserCode ?? (await mintUniqueAdviserCode(excludeCodes));
        if (section.adviserCode) excludeCodes.add(section.adviserCode);
        note = "patched label/code";
        if (!DRY) {
          section = await prisma.section.update({
            where: { id: section.id },
            data: { adviserLabel: section.adviserLabel ?? adviserLabel, adviserCode: code },
            select: { id: true, name: true, gradeLevel: true, adviserId: true, adviserLabel: true, adviserCode: true },
          });
        } else {
          section = { ...section, adviserLabel: section.adviserLabel ?? adviserLabel, adviserCode: code };
        }
      } else {
        note = "kept";
      }
      // Grade drift guard: name matched but grade differs — report, don't move students.
      if (section.gradeLevel !== def.gradeLevel) note += ` GRADE_MISMATCH(db=${section.gradeLevel})`;
    }

    const have = DRY && section.id === "(dry)"
      ? 0
      : await prisma.studentRoster.count({ where: { sectionId: section.id } });
    const need = Math.max(0, PER_SECTION - have);

    if (need > 0 && !DRY) {
      const gradeNum = def.gradeLevel.replace("G", "");
      const rows = [];
      for (let k = 0; k < need; k++) {
        const lrn = makeLrn(rng, gradeNum, String((have + k) % 10));
        rows.push({
          lrn,
          fullName: names[nameIdx++ % names.length],
          gradeLevel: def.gradeLevel as never,
          sectionId: section.id,
          schoolYearId: sy.id,
        });
      }
      const res = await prisma.studentRoster.createMany({ data: rows, skipDuplicates: true });
      rosterAdded += res.count;
    } else {
      nameIdx += need; // keep name stream aligned in dry-run
    }

    console.log(`${section.name},${section.gradeLevel},${have},${need},${have + need},${section.adviserLabel ?? ""},${section.adviserCode ?? ""},${note}`);
  }

  console.log(`Done — sections created: ${sectionsCreated}, roster added: ${rosterAdded} (target ${SECTION_DEFS.length} sections x ${PER_SECTION})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
