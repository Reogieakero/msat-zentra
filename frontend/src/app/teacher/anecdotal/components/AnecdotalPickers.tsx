"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  AnecdotalClassOption,
  AnecdotalStudent,
} from "@/services/anecdotal/anecdotal.types";
import styles from "./AnecdotalChat.module.css";

const PAGE_SIZE = 10;

/** Student picker: search + paged table inside a popover. Owns its
 *  query/page state — the parent only learns the picked student id. */
export function StudentPicker({
  open,
  onOpenChange,
  students,
  sectionNameById,
  selectedId,
  isPending,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: AnecdotalStudent[];
  sectionNameById: Map<string, string>;
  selectedId: string;
  isPending: boolean;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const needle = query.trim().toLowerCase();
  const visible = students.filter((s) => {
    if (!needle) return true;
    return (
      s.name.toLowerCase().includes(needle) ||
      s.lrn.includes(needle) ||
      (sectionNameById.get(s.sectionId ?? "") ?? "")
        .toLowerCase()
        .includes(needle)
    );
  });
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const rows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = students.find((s) => s.id === selectedId) ?? null;

  const pick = (id: string) => {
    onPick(id);
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`${styles.pickerBtn} ${
            selected ? styles.pickerSet : ""
          }`}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className={styles.pickerLabel}>
            {selected
              ? `${selected.name} · ${
                  sectionNameById.get(selected.sectionId ?? "") ?? ""
                }`
              : "Student"}
          </span>
          <ChevronDown className={styles.pickerChevron} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={styles.dropPanel}
        align="start"
      >
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search students…"
          aria-label="Search students"
          className={styles.dropSearch}
        />
        <table className={styles.dropTable}>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">LRN</th>
              <th scope="col">Section</th>
              <th scope="col">
                <span className={styles.srOnly}>Selected</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr
                key={s.id}
                className={`${styles.dropRow} ${
                  s.id === selectedId ? styles.dropRowActive : ""
                }`}
                tabIndex={0}
                onClick={() => pick(s.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    pick(s.id);
                  }
                }}
              >
                <td className={styles.dropName}>{s.name}</td>
                <td className={styles.dropDim}>{s.lrn}</td>
                <td className={styles.dropDim}>
                  {sectionNameById.get(s.sectionId ?? "") ?? "—"}
                </td>
                <td className={styles.dropCheck}>
                  {s.id === selectedId ? (
                    <Check aria-hidden />
                  ) : null}
                </td>
              </tr>
            ))}
            {isPending ? (
              <tr aria-hidden>
                <td colSpan={4}>
                  <div className={styles.dropSkelRows}>
                    <Skeleton className={styles.dropSkel} />
                    <Skeleton className={styles.dropSkel} />
                    <Skeleton className={styles.dropSkel} />
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className={styles.dropDim}
                >
                  No students match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className={styles.dropPagination}>
            <button
              type="button"
              className={styles.dropPageBtn}
              disabled={page <= 1}
              onClick={() =>
                setPage((p) => Math.max(1, p - 1))
              }
              aria-label="Previous page"
            >
              Prev
            </button>
            <span className={styles.dropPageInfo}>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              className={styles.dropPageBtn}
              disabled={page >= totalPages}
              onClick={() =>
                setPage((p) =>
                  Math.min(totalPages, p + 1)
                )
              }
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Class picker: the picked student's subjects, same popover pattern. */
export function ClassPicker({
  open,
  onOpenChange,
  classes,
  selectedKey,
  hasStudent,
  isPending,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: AnecdotalClassOption[];
  selectedKey: string;
  hasStudent: boolean;
  isPending: boolean;
  onPick: (key: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const needle = query.trim().toLowerCase();
  const visible = classes.filter((c) => {
    if (!needle) return true;
    return (
      c.subjectName.toLowerCase().includes(needle) ||
      c.sectionName.toLowerCase().includes(needle)
    );
  });
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const rows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected =
    classes.find(
      (c) => `${c.subjectId}|${c.sectionId}|${c.termId}` === selectedKey
    ) ?? null;

  const pick = (key: string) => {
    onPick(key);
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`${styles.pickerBtn} ${
            selected ? styles.pickerSet : ""
          }`}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className={styles.pickerLabel}>
            {selected
              ? `${selected.subjectName} · ${selected.sectionName}`
              : "Class"}
          </span>
          <ChevronDown className={styles.pickerChevron} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={styles.dropPanel}
        align="start"
      >
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search subjects…"
          aria-label="Search student's subjects"
          className={styles.dropSearch}
        />
        <table className={styles.dropTable}>
          <thead>
            <tr>
              <th scope="col">Subject</th>
              <th scope="col">Teacher</th>
              <th scope="col">
                <span className={styles.srOnly}>Selected</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const key = `${c.subjectId}|${c.sectionId}|${c.termId}`;
              return (
                <tr
                  key={key}
                  className={`${styles.dropRow} ${
                    key === selectedKey ? styles.dropRowActive : ""
                  }`}
                  tabIndex={0}
                  onClick={() => pick(key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      pick(key);
                    }
                  }}
                >
                  <td className={styles.dropName}>
                    {c.subjectName}
                  </td>
                  <td className={styles.dropDim}>
                    {c.ownerName ?? "—"}
                  </td>
                  <td className={styles.dropCheck}>
                    {key === selectedKey ? (
                      <Check aria-hidden />
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {isPending ? (
              <tr aria-hidden>
                <td colSpan={3}>
                  <div className={styles.dropSkelRows}>
                    <Skeleton className={styles.dropSkel} />
                    <Skeleton className={styles.dropSkel} />
                    <Skeleton className={styles.dropSkel} />
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className={styles.dropDim}
                >
                  {hasStudent
                    ? "No subjects for this student."
                    : "Pick a student to see their subjects."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className={styles.dropPagination}>
            <button
              type="button"
              className={styles.dropPageBtn}
              disabled={page <= 1}
              onClick={() =>
                setPage((p) => Math.max(1, p - 1))
              }
              aria-label="Previous page"
            >
              Prev
            </button>
            <span className={styles.dropPageInfo}>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              className={styles.dropPageBtn}
              disabled={page >= totalPages}
              onClick={() =>
                setPage((p) =>
                  Math.min(totalPages, p + 1)
                )
              }
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
