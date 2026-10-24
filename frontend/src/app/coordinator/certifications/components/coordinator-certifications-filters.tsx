"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CERT_STATUS_META } from "@/services/coordinator/certifications.service";
import type {
  CertStatus,
  CertStatusFilter,
} from "@/services/coordinator/certifications.types";
import styles from "./coordinator-certifications-filters.module.css";

const OPTIONS: { value: CertStatusFilter; label: string; color?: string }[] = [
  { value: "all", label: "All statuses" },
  ...(["prepared", "awaiting", "revision", "approved"] as CertStatus[]).map(
    (s) => ({
      value: s as CertStatusFilter,
      label: CERT_STATUS_META[s].label,
      color: CERT_STATUS_META[s].color,
    }),
  ),
];

interface CoordinatorCertificationsFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  status: CertStatusFilter;
  onStatusChange: (value: CertStatusFilter) => void;
}

export function CoordinatorCertificationsFilters({
  query,
  onQueryChange,
  status,
  onStatusChange,
}: CoordinatorCertificationsFiltersProps) {
  const hasActiveFilters = status !== "all";
  const activeOption = OPTIONS.find((o) => o.value === status);
  const statusLabel = activeOption?.label ?? "Status";

  return (
    <div className={styles.filters}>
      <div className={styles.searchWrap}>
        <Search className={styles.searchIcon} aria-hidden />
        <Input
          className={styles.search}
          placeholder="Search student, LRN…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search certifications"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`${styles.filterBtn} ${status !== "all" ? styles.filterActive : ""}`}
          >
            {status === "all" ? "Status" : statusLabel}
            {status !== "all" && activeOption?.color ? (
              <span
                className={styles.filterDot}
                style={{ backgroundColor: activeOption.color }}
                aria-hidden
              />
            ) : null}
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={styles.filterMenu}>
          {OPTIONS.map((item, index) => (
            <div key={item.label}>
              {index === 1 && <DropdownMenuSeparator />}
              <DropdownMenuCheckboxItem
                checked={status === item.value}
                onCheckedChange={() => onStatusChange(item.value)}
              >
                {item.color ? (
                  <span
                    className={styles.optionDot}
                    style={{ backgroundColor: item.color }}
                    aria-hidden
                  />
                ) : null}
                {item.label}
              </DropdownMenuCheckboxItem>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className={styles.clearBtn}
          onClick={() => {
            onStatusChange("all");
          }}
        >
          <X aria-hidden />
          Clear
        </Button>
      )}
    </div>
  );
}
