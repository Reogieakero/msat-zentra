import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const p = new PrismaClient();

const FN = ["Maria","Juan","Ana","Pedro","Sofia","Lucas","Elena","Miguel","Rosa","Jose","Carmen","Antonio","Lucia","Diego","Gabriela","Andres","Isabella","Rafael","Paula","Manuel"];
const LN = ["Santos","Reyes","Cruz","Garcia","Mendoza","Torres","Flores","Ramos","Diaz","Castillo","Manalo","Bautista","Villanueva","Ocampo","Aquino","Salazar"];

(async () => {
  // 1) Remove the 12 roster-only (no-account) rows added earlier: those whose lrn
  //    has no matching student_profile.
  const allRoster = await p.studentRoster.findMany({ select: { id: true, lrn: true } });
  const profLrns = new Set((await p.studentProfile.findMany({ select: { lrn: true } })).map((s) => s.lrn));
  const orphanRosterIds = allRoster.filter((r) => !profLrns.has(r.lrn)).map((r) => r.id);
  if (orphanRosterIds.length) {
    const del = await p.studentRoster.deleteMany({ where: { id: { in: orphanRosterIds } } });
    console.log("removed no-account roster rows:", del.count);
  } else {
    console.log("removed no-account roster rows: 0");
  }

  const year = await p.schoolYear.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!year) { console.log("no active year"); process.exit(1); }
  const secs = await p.section.findMany({ where: { gradeLevel: { in: ["G11","G12"] } }, select: { id: true, name: true, gradeLevel: true } });

  const hash = await argon2.hash("Student2025!");
  const usedEmail = new Set((await p.user.findMany({ select: { email: true } })).map((u) => u.email));
  const usedLrn = new Set((await p.studentProfile.findMany({ select: { lrn: true } })).map((s) => s.lrn));
  let n = 0;
  let lrnSeed = 700000000;
  let emailSeed = 1;

  for (const s of secs) {
    for (let k = 0; k < 2; k++) {
      let lrn; do { lrn = "20" + (lrnSeed++).toString().padStart(9, "0"); } while (usedLrn.has(lrn));
      usedLrn.add(lrn);
      let email; do { email = `pending.student.${emailSeed++}@zentra.test`; } while (usedEmail.has(email));
      usedEmail.add(email);
      const name = FN[n % FN.length] + " " + LN[(n * 3) % LN.length];

      const user = await p.user.create({
        data: { email, fullName: name, role: "student", passwordHash: hash, status: "pending", contactNumber: "+63 900 000 0000" },
      });
      await p.studentProfile.create({
        data: { userId: user.id, lrn, gradeLevel: s.gradeLevel, sectionId: s.id, birthdate: new Date("2008-05-12"), address: "Mati City" },
      });
      // Keep roster in sync so the breakdown's roster source reflects this enrollment.
      await p.studentRoster.upsert({
        where: { lrn_schoolYearId: { lrn, schoolYearId: year.id } },
        update: { fullName: name, gradeLevel: s.gradeLevel, sectionId: s.id },
        create: { lrn, fullName: name, gradeLevel: s.gradeLevel, sectionId: s.id, schoolYearId: year.id },
      });
      n++;
    }
  }
  console.log("created pending student accounts:", n);
})().finally(() => process.exit(0));
