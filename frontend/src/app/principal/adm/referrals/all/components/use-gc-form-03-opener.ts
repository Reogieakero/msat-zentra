"use client";
import * as React from "react";
import { buildGcForm03Data } from "@/services/guidance/gcform03.service";
import type { GcForm03Data } from "@/services/guidance/gcform03.types";
import {
  fetchOcForm01Detail,
  type OcForm01Detail,
} from "@/components/ocform01/ocform01";
import type { AdmReferralRow } from "@/services/principal/adm.types";
export function useGcForm03Opener() {
  const [gcOpen, setGcOpen] = React.useState(false);
  const [gcData, setGcData] = React.useState<GcForm03Data | null>(null);
  const [gcLoading, setGcLoading] = React.useState(false);
  const openGcForm03 = React.useCallback(
    async (r: AdmReferralRow) => {
      if (gcLoading || !r.anecdotalRecordId) return;
      setGcLoading(true);
      try {
        let report: OcForm01Detail | null = null;
        try {
          report = await fetchOcForm01Detail(r.anecdotalRecordId);
        } catch {
          report = null;
        }
        const data = buildGcForm03Data(
          {
            student: r.student,
            grade: r.grade,
            section: r.section,
            reason: "",
            referredBy: r.preparedBy,
            date: r.datePrepared,
          },
          report,
          "",
        );
        setGcData(data);
        setGcOpen(true);
      } finally {
        setGcLoading(false);
      }
    },
    [gcLoading],
  );
  return { gcOpen, setGcOpen, gcData, gcLoading, openGcForm03 };
}
