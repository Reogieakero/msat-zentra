import { prisma } from "../../lib/prisma.js";

export interface FormSigner {
  id: string;
  fullName: string;
  role: "nurse" | "guidance_counselor";
}

/**
 * Staff who can sign the GCForm-03 staff section. The guidance counselor is
 * the signer for ADM referrals, so only guidance counselors are offered.
 */
export async function listFormSigners(): Promise<{ staff: FormSigner[] }> {
  const staff = await prisma.user.findMany({
    where: {
      status: "active",
      role: "guidance_counselor",
    },
    select: { id: true, fullName: true, role: true },
    orderBy: [{ fullName: "asc" }],
  });
  return { staff: staff as FormSigner[] };
}
