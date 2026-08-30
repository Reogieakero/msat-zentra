import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const FN = ["Maria","Juan","Ana","Pedro","Sofia","Lucas","Elena","Miguel","Rosa","Jose","Carmen","Antonio","Lucia","Diego","Gabriela","Andres","Isabella","Rafael","Paula","Manuel"];
const LN = ["Santos","Reyes","Cruz","Garcia","Mendoza","Torres","Flores","Ramos","Diaz","Castillo","Manalo","Bautista","Villanueva","Ocampo","Aquino","Salazar"];

(async () => {
  const year = await p.schoolYear.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!year) { console.log("no active year"); process.exit(1); }
  const secs = await p.section.findMany({ where: { gradeLevel: { in: ["G11","G12"] } }, select: { id: true, name: true, gradeLevel: true } });
  const used = new Set((await p.studentProfile.findMany({ select: { lrn: true } })).map((r) => r.lrn));
  let n = 0;
  let lrnSeed = 500000000;
  for (const s of secs) {
    for (let k = 0; k < 2; k++) {
      let lrn;
      do { lrn = "20" + (lrnSeed++).toString().padStart(9, "0"); } while (used.has(lrn));
      used.add(lrn);
      const name = FN[n % FN.length] + " " + LN[(n * 3) % LN.length];
      await p.studentRoster.create({ data: { lrn, fullName: name, gradeLevel: s.gradeLevel, sectionId: s.id, schoolYearId: year.id } });
      n++;
    }
  }
  console.log("added no-account roster students:", n);
})().finally(() => process.exit(0));
