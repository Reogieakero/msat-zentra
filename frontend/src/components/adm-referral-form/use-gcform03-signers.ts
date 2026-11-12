"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface GcFormSigner {
  id: string;
  fullName: string;
  role: "nurse" | "guidance_counselor";
}

/**
 * Guidance counselors who can print their name on the GCForm-03 staff
 * section. The referral form defaults to the first one.
 */
export function useGcFormSigners() {
  return useQuery({
    queryKey: ["gcform03-signers"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ staff: GcFormSigner[] }>(
        "/api/referrals/form-signers?role=guidance_counselor"
      );
      return data.staff;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function defaultGcFormSigner(
  signers: GcFormSigner[] | undefined
): GcFormSigner | null {
  if (!signers || signers.length === 0) return null;
  return (
    signers.find((s) => s.role === "guidance_counselor") ?? signers[0] ?? null
  );
}
