"use client";
import * as React from "react";
import type { NurseAlertItem } from "@/services/nurse/nurse.types";
import {
  isEndorsed,
  isWithdrawn,
  matchesActionFilter,
  type ActionFilter,
  type ActionValue,
  type TypeFilter,
} from "./nurse-referrals-format";
const PAGE_SIZE = 15;
export function useNurseAlertFilters({
  alerts,
  initialType = "",
  highlightId,
  serverDriven,
  serverPage,
  serverTotal,
  serverTotalPages,
}: {
  alerts: NurseAlertItem[];
  initialType?: TypeFilter;
  highlightId?: string | null;
  serverDriven: boolean;
  serverPage?: number;
  serverTotal?: number;
  serverTotalPages?: number;
}) {
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>(initialType);
  const [actionFilter, setActionFilter] = React.useState<ActionFilter>("");
  const [page, setPage] = React.useState(1);
  const [paged, setPaged] = React.useState(false);
  const highlightPage = React.useMemo(() => {
    if (!highlightId || alerts.length === 0) return null;
    const sorted = [...alerts].sort((a, b) => {
      const aDate = a.row.date === "—" ? "" : a.row.date;
      const bDate = b.row.date === "—" ? "" : b.row.date;
      const dateCmp = bDate.localeCompare(aDate);
      if (dateCmp !== 0) return dateCmp;
      return b.sortTime - a.sortTime;
    });
    const idx = sorted.findIndex((a) => a.row.id === highlightId);
    return idx >= 0 ? Math.floor(idx / PAGE_SIZE) + 1 : null;
  }, [alerts, highlightId]);
  const effPage = serverDriven
    ? (serverPage ?? 1)
    : !paged && highlightPage !== null
      ? highlightPage
      : page;
  const filtered = React.useMemo(() => {
    const rows = alerts.filter((a) => {
      if (typeFilter !== "" && a.row.type !== typeFilter) return false;
      if (actionFilter !== "" && !matchesActionFilter(a.row, actionFilter)) return false;
      return true;
    });
    rows.sort((a, b) => {
      const aDate = a.row.date === "—" ? "" : a.row.date;
      const bDate = b.row.date === "—" ? "" : b.row.date;
      const dateCmp = bDate.localeCompare(aDate);
      if (dateCmp !== 0) return dateCmp;
      return b.sortTime - a.sortTime;
    });
    return rows;
  }, [alerts, typeFilter, actionFilter]);
  const actionCounts = React.useMemo(() => {
    const counts: Record<ActionValue, number> = {
      adm_needs: 0,
      endorse: 0,
      followup: 0,
      booked: 0,
      reject: 0,
      adm_cancelled: 0,
      clinic_needs: 0,
      clinic_booked: 0,
      clinic_done: 0,
      clinic_followup: 0,
      clinic_cancelled: 0,
    };
    for (const a of alerts) {
      if (a.row.type === "ADM") {
        if (a.row.status === "pending") counts.adm_needs += 1;
        if (isEndorsed(a.row.type, a.row.status)) counts.endorse += 1;
        if (a.row.status === "follow_up") counts.followup += 1;
        if (a.row.sessions.length > 0) counts.booked += 1;
        if (a.row.status === "dismissed" && !isWithdrawn(a.row)) counts.reject += 1;
        if (isWithdrawn(a.row)) counts.adm_cancelled += 1;
      } else if (a.row.type === "Clinic") {
        if (a.row.status === "pending") counts.clinic_needs += 1;
        if (a.row.sessions.length > 0) counts.clinic_booked += 1;
        if (a.row.sessions.some((s) => s.status === "completed")) counts.clinic_done += 1;
        if (a.row.status === "follow_up") counts.clinic_followup += 1;
        if (isWithdrawn(a.row)) counts.clinic_cancelled += 1;
      }
    }
    return counts;
  }, [alerts]);
  const total = serverDriven ? (serverTotal ?? filtered.length) : filtered.length;
  const totalPages = serverDriven
    ? Math.max(1, serverTotalPages ?? 1)
    : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(effPage, totalPages);
  return {
    typeFilter,
    setTypeFilter,
    actionFilter,
    setActionFilter,
    page,
    setPage,
    paged,
    setPaged,
    highlightPage,
    effPage,
    filtered,
    actionCounts,
    total,
    totalPages,
    safePage,
    pageSize: PAGE_SIZE,
  };
}
