"use client";
import * as React from "react";
import { Sf10Page } from "@/components/registry/sf10/sf10-page";
import { PAGE_SIZE } from "@/components/shared/pagination";
export default function RecordKeeperSf10Page() {
  return (
    <React.Suspense>
      <Sf10Page desk="record-keeper" pageSize={PAGE_SIZE} gradeRange="7–10" />
    </React.Suspense>
  );
}
