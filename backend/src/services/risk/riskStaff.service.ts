import { prisma } from "../../lib/prisma.js";

export async function getRiskStaff() {
  const staff = await prisma.user.findMany({
    where: {
      role: {
        in: [
          "subject_teacher",
          "adviser",
          "nurse",
          "adm_coordinator",
          "guidance_counselor",
          "record_keeper",
          "registrar",
        ],
      },
    },
    select: { id: true, fullName: true, role: true },
    orderBy: [{ role: "asc" }, { fullName: "asc" }],
  });
  return staff;
}
