import type { FolderFile } from "@/components/ui/FolderCard";
import type { GuidanceAnecdotalRecord } from "@/services/guidance/anecdotal.types";

export const SESSION_KIND_LABEL: Record<string, string> = {
  individual: "One-on-one",
  parent_conference: "Parent conference",
  group: "Group",
  home_visit: "Home visit",
};

export type SessionKind = "individual" | "parent_conference" | "group" | "home_visit";

export function sessionKindOf(value: string): SessionKind {
  return value === "parent_conference" ||
    value === "group" ||
    value === "home_visit"
    ? value
    : "individual";
}

export function isImageMime(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith("image/");
}

export interface DocEntry {
  file: FolderFile;
  image: { id: string; fileUrl: string; fileName: string };
}

/** Turns the record's session attachments into folder slips (images only). */
export function docSlipsFor(record: GuidanceAnecdotalRecord, cap = 5): DocEntry[] {
  const docs: DocEntry[] = [];
  for (const s of record.sessionDocs ?? []) {
    const kind = sessionKindOf(s.sessionType);
    for (const f of s.files) {
      if (!isImageMime(f.mimeType)) continue;
      docs.push({
        file: {
          name: f.fileName,
          tag: `${SESSION_KIND_LABEL[kind]} • ${s.date}`,
          tone: ((docs.length % 5) + 1) as FolderFile["tone"],
          icon: "image",
          thumbUrl: f.fileUrl,
          sessionKind: kind,
        },
        image: { id: f.id, fileUrl: f.fileUrl, fileName: f.fileName },
      });
      if (docs.length >= cap) break;
    }
    if (docs.length >= cap) break;
  }
  return docs;
}
