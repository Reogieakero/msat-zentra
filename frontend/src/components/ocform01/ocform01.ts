import { apiClient } from "@/lib/api/client";

/**
 * Shared OCForm-01 (GCForm-01) helpers — used by the advisory anecdotal
 * list and the filing chat so teachers can preview/print/download the
 * official form without leaving the page they are on.
 */

/** Payload backing the printable / .xlsx OCForm-01 sheet (GET /api/anecdotal/:id/detail). */
export interface OcForm01Detail {
  observerName: string;
  gradeSection: string;
  observationDate: string;
  observationTime: string;
  studentName: string;
  descriptionOfIncident: string;
  descriptionOfLocation: string;
  notesRecommendationsActions: string;
  classPerformance: string;
  attendanceSummary: string;
  /** Printed name on the signature line (section adviser, else observer). */
  adviserName: string;
  /** Whether the viewer may sign (section adviser, else observer). */
  canSign: boolean;
  /** Drawn sign-off, or null while unsigned. */
  signature: { by: string; at: string; imageUrl: string } | null;
}

export async function fetchOcForm01Detail(recordId: string): Promise<OcForm01Detail> {
  const { data } = await apiClient.get<OcForm01Detail>(
    `/api/anecdotal/${recordId}/detail`
  );
  return data;
}

/** Downloads the official OCForm-01 .xlsx for one record (GET /api/anecdotal/:id/export). */
export async function downloadOcForm01(recordId: string): Promise<void> {
  const res = await apiClient.get(`/api/anecdotal/${recordId}/export`, {
    responseType: "blob",
  });
  const disposition: string | undefined = res.headers?.["content-disposition"];
  const match = disposition?.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `OCForm-01_${recordId}.xlsx`;
  const url = window.URL.createObjectURL(
    new Blob([res.data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

/** Applies a drawn PNG data-URL signature (POST /api/anecdotal/:id/sign). */
export async function signRecord(recordId: string, signatureImage: string): Promise<void> {
  await apiClient.post(`/api/anecdotal/${recordId}/sign`, { signatureImage });
}

/** Removes the signature, returning the form to unsigned (DELETE …/sign). */
export async function unsignRecord(recordId: string): Promise<void> {
  await apiClient.delete(`/api/anecdotal/${recordId}/sign`);
}

/** The teacher's one reusable drawn signature (GET /api/anecdotal/signature). */
export async function fetchMySignature(): Promise<{ imageUrl: string | null }> {
  const { data } = await apiClient.get<{ imageUrl: string | null }>(
    "/api/anecdotal/signature"
  );
  return data;
}

/** Saves (or replaces) the teacher's reusable signature (PUT …/signature). */
export async function saveMySignature(signatureImage: string): Promise<void> {
  await apiClient.put("/api/anecdotal/signature", { signatureImage });
}

/** Stamps the saved signature onto one record (POST /:id/apply-signature). */
export async function applyMySignature(recordId: string): Promise<void> {
  await apiClient.post(`/api/anecdotal/${recordId}/apply-signature`);
}
