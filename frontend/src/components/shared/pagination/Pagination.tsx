"use client";

import { ZentraPagination, type ZentraPaginationProps } from "./ZentraPagination";

/** Canonical alias: one shared <Pagination /> used by every module. */
export function Pagination(props: ZentraPaginationProps) {
  return <ZentraPagination {...props} />;
}
