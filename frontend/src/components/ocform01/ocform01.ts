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

const detailCache = new Map<string, { data: OcForm01Detail; at: number }>();
const DETAIL_TTL_MS = 30_000;

export async function fetchOcForm01Detail(recordId: string): Promise<OcForm01Detail> {
  const cached = detailCache.get(recordId);
  if (cached && Date.now() - cached.at < DETAIL_TTL_MS) return cached.data;
  const { data } = await apiClient.get<OcForm01Detail>(
    `/api/anecdotal/${recordId}/detail`
  );
  detailCache.set(recordId, { data, at: Date.now() });
  return data;
}

export function invalidateOcForm01Detail(recordId?: string) {
  if (recordId) detailCache.delete(recordId);
  else detailCache.clear();
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "record";
}

export function buildOcForm01ImageFilename(
  detail: { studentName?: string; observationDate?: string },
  recordId: string,
  ext: "png" | "jpg" | "pdf",
): string {
  const raw = (detail.observationDate ?? "").trim();
  let datePart = "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.slice(0, 10))) {
    datePart = raw.slice(0, 10);
  } else if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      datePart = parsed.toISOString().slice(0, 10);
    } else {
      datePart = slugify(raw.slice(0, 10));
    }
  } else {
    datePart = slugify(recordId);
  }
  const namePart = detail.studentName ? slugify(detail.studentName) : slugify(recordId);
  return `GCForm-01_${namePart}_${datePart}.${ext}`;
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
  detailCache.delete(recordId);
}
