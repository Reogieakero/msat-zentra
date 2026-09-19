"use client";

import * as React from "react";
import { Image as ImageIcon, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type DocEntry, entryStatusLabel, entryStatusVariant } from "./documentaries-utils";
import { formatDate } from "../../referrals/components/nurse-referrals-format";
import type { SortKey } from "./documentaries-utils";
import styles from "./NurseDocumentariesList.module.css";

export interface DocumentaryTableProps {
  filtered: DocEntry[];
  pageRows: DocEntry[];
  total: number;
  start: number;
  end: number;
  safePage: number;
  totalPages: number;
  onSort: (key: SortKey) => void;
  onPageChange: (p: number) => void;
  onOpenDetails: (entry: DocEntry) => void;
  onOpenViewer: (entry: DocEntry, index: number) => void;
}

export function DocumentaryTable({
  filtered,
  pageRows,
  total,
  start,
  end,
  safePage,
  totalPages,
  onSort,
  onPageChange,
  onOpenDetails,
  onOpenViewer,
}: DocumentaryTableProps) {
  return (
    <>
      <div className={styles.tableWrap}>
        {filtered.length === 0 ? (
          <p className={styles.empty}>
            No finished transactions yet — completed sessions and resolved cases will be archived here.
          </p>
        ) : pageRows.length === 0 ? (
          <p className={styles.empty}>No records match your search and filters.</p>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>
                    <button type="button" className={styles.thBtn} onClick={() => onSort("referral")} aria-label="Sort by referral ID">
                      Referral ID
                    </button>
                  </th>
                  <th>LRN</th>
                  <th>
                    <button type="button" className={styles.thBtn} onClick={() => onSort("date")} aria-label="Sort by date">
                      Date
                    </button>
                  </th>
                  <th>Type</th>
                  <th>
                    <button type="button" className={styles.thBtn} onClick={() => onSort("status")} aria-label="Sort by session status">
                      Session status
                    </button>
                  </th>
                  <th>Files</th>
                  <th>
                    <span className={styles.srOnly}>Row actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((entry) => (
                  <tr key={entry.key}>
                    <td>
                      <span className={styles.caseNo} title={entry.row.id}>
                        {entry.row.id.length > 13 ? `${entry.row.id.slice(0, 13)}…` : entry.row.id}
                      </span>
                    </td>
                    <td>
                      <p className={styles.cellMain}>
                        <span className={styles.lrn}>{entry.row.lrn}</span>
                      </p>
                    </td>
                    <td className={styles.nowrap}>{formatDate(entry.dateDay)}</td>
                    <td>
                      {entry.isEndorse ? (
                        <Badge variant="destructive">Endorse ADM</Badge>
                      ) : entry.row.type === "ADM" ? (
                        <Badge variant="secondary">ADM</Badge>
                      ) : (
                        <Badge variant="outline">Clinic</Badge>
                      )}
                    </td>
                    <td>
                      <Badge variant={entryStatusVariant(entry)}>
                        {entryStatusLabel(entry)}
                      </Badge>
                    </td>
                    <td>
                      {entry.files.length === 0 ? (
                        <span className={styles.noFiles}>—</span>
                      ) : (
                        <button
                          type="button"
                          className={styles.filesIconBtn}
                          onClick={() => onOpenViewer(entry, 0)}
                          aria-label={`View ${entry.files.length} attached image${entry.files.length === 1 ? "" : "s"}`}
                          title={`${entry.files.length} image${entry.files.length === 1 ? "" : "s"} — click to view`}
                        >
                          <ImageIcon size={18} aria-hidden />
                          <span className={styles.filesCount} aria-hidden>
                            {entry.files.length > 1 ? `×${entry.files.length}` : ""}
                          </span>
                        </button>
                      )}
                    </td>
                    <td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className={styles.moreBtn} aria-label="Record actions">
                            <MoreHorizontal size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className={styles.moreMenu}>
                          <DropdownMenuItem onSelect={() => onOpenDetails(entry)}>View details</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className={styles.pager}>
        <p className={styles.range}>Showing {start}–{end} of {total}</p>
        <div className={styles.pagerButtons}>
          <Button size="xs" variant="outline" disabled={safePage <= 1} onClick={() => onPageChange(Math.max(1, safePage - 1))}>Previous</Button>
          <span className={styles.pageLabel} aria-live="polite">Page {safePage} of {totalPages}</span>
          <Button size="xs" variant="outline" disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)}>Next</Button>
        </div>
      </div>
    </>
  );
}
