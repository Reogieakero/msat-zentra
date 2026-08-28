import * as React from "react";
import { Folder, FileText } from "lucide-react";
import { ADM_DOCUMENTS, type AdmDocument } from "../mockData";
import docs from "./admDocs.module.css";
import legend from "./admLegend.module.css";

export function DocumentCard({
  doc,
  style,
  bare = false,
}: {
  doc: AdmDocument;
  style?: React.CSSProperties;
  bare?: boolean;
}) {
  return (
    <span
      className={`${docs.docCard} ${bare ? docs.bare : ""}`}
      style={{ ["--doc-color" as string]: doc.color, ...style }}
      title={doc.name}
    >
      <span className={docs.docFolder}>
        <Folder className={docs.docFolderIcon} aria-hidden />
        <span className={docs.docFileTab} />
        <span className={docs.docFile}>
          <FileText className={docs.docFileIcon} aria-hidden />
        </span>
      </span>
    </span>
  );
}

export const DOC_LEGEND: { color: string; label: string }[] = [
  { color: "#ffc371", label: "Referral" },
  { color: "#4facfe", label: "Anecdotal" },
  { color: "#00f2fe", label: "Certification" },
  { color: "#a18cd1", label: "Minutes" },
  { color: "#ff5f6d", label: "Home Visit" },
];

export function DocumentsPanel({ caseLabel }: { caseLabel: string }) {
  return (
    <aside className={`${docs.admDocsPanel} ${docs.docsPanel}`}>
      <div className={docs.docsHeader}>
        <p className={docs.docsFor}>Latest referred · {caseLabel}</p>
      </div>
      <div className={docs.docsRow}>
        {ADM_DOCUMENTS.map((doc, i) => (
          <DocumentCard
            key={doc.name}
            doc={doc}
            style={{ animationDelay: `${Math.min(i, 24) * 160}ms` }}
          />
        ))}
      </div>
      <div className={legend.docLegend}>
        {DOC_LEGEND.map((item) => (
          <span key={item.label} className={legend.docLegendItem}>
            <span
              className={legend.docLegendSwatch}
              style={{ background: item.color }}
            />
            <span className={legend.docLegendLabel}>{item.label}</span>
          </span>
        ))}
      </div>
    </aside>
  );
}
