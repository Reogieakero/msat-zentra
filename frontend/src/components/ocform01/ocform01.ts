import { apiClient } from "@/lib/api/client";

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

  adviserName: string;

  canSign: boolean;

  signature: { by: string; at: string; imageUrl: string } | null;
}

export async function fetchOcForm01Detail(recordId: string): Promise<OcForm01Detail> {
  const { data } = await apiClient.get<OcForm01Detail>(
    `/api/anecdotal/${recordId}/detail`
  );
  return data;
}

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

export async function signRecord(recordId: string, signatureImage: string): Promise<void> {
  await apiClient.post(`/api/anecdotal/${recordId}/sign`, { signatureImage });
}

export async function unsignRecord(recordId: string): Promise<void> {
  await apiClient.delete(`/api/anecdotal/${recordId}/sign`);
}

export async function fetchMySignature(): Promise<{ imageUrl: string | null }> {
  const { data } = await apiClient.get<{ imageUrl: string | null }>(
    "/api/anecdotal/signature"
  );
  return data;
}

export async function saveMySignature(signatureImage: string): Promise<void> {
  await apiClient.put("/api/anecdotal/signature", { signatureImage });
}

export async function applyMySignature(recordId: string): Promise<void> {
  await apiClient.post(`/api/anecdotal/${recordId}/apply-signature`);
}
