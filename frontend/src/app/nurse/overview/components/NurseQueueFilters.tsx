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
import styles from "./nurse-overview.module.css";

export type NurseQueueTypeFilter = "" | "ADM" | "Clinic";

const TYPES: { value: NurseQueueTypeFilter; label: string }[] = [
  { value: "", label: "All types" },
  { value: "ADM", label: "ADM case" },
  { value: "Clinic", label: "Clinic" },
];

interface NurseQueueFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  typeFilter: NurseQueueTypeFilter;
  onTypeChange: (value: NurseQueueTypeFilter) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  statusOptions: { value: string; label: string }[];
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  categoryOptions: string[];
  onClear: () => void;
}

function FilterDropdown({
  label,
  activeLabel,
  isActive,
  ariaLabel,
  children,
}: {
  label: string;
  activeLabel: string;
  isActive: boolean;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={`${ariaLabel}, currently showing: ${activeLabel}`}
          className={`${styles.filterBtn} ${isActive ? styles.filterActive : ""}`}
        >
          {label}
          {isActive && <span className={styles.filterDot} aria-hidden />}
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={styles.filterMenu}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NurseQueueFilters({
  query,
  onQueryChange,
  typeFilter,
  onTypeChange,
  statusFilter,
  onStatusChange,
  statusOptions,
  categoryFilter,
  onCategoryChange,
  categoryOptions,
  onClear,
}: NurseQueueFiltersProps) {
  const hasActiveFilters =
    query.trim() !== "" || typeFilter !== "" || statusFilter !== "" || categoryFilter !== "";
  const typeLabel = TYPES.find((t) => t.value === typeFilter)?.label ?? "All types";
  const statusLabel =
    statusOptions.find((s) => s.value === statusFilter)?.label ?? "All statuses";

  return (
    <div className={styles.filters}>
      <div className={styles.searchWrap}>
        <Search className={styles.searchIcon} aria-hidden />
        <Input
          className={styles.search}
          placeholder="Search name, LRN, or reason…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search cases needing review"
        />
      </div>

      <FilterDropdown
        label={typeFilter === "" ? "Type" : typeLabel}
        activeLabel={typeLabel}
        isActive={typeFilter !== ""}
        ariaLabel="Filter cases by type"
      >
        {TYPES.map((item, index) => (
          <div key={item.label}>
            {index === 1 && <DropdownMenuSeparator />}
            <DropdownMenuCheckboxItem
              checked={typeFilter === item.value}
              onCheckedChange={() => onTypeChange(item.value)}
            >
              {item.label}
            </DropdownMenuCheckboxItem>
          </div>
        ))}
      </FilterDropdown>

      <FilterDropdown
        label={statusFilter === "" ? "Status" : statusLabel}
        activeLabel={statusLabel}
        isActive={statusFilter !== ""}
        ariaLabel="Filter cases by status"
      >
        <DropdownMenuCheckboxItem
          checked={statusFilter === ""}
          onCheckedChange={() => onStatusChange("")}
        >
          All statuses
        </DropdownMenuCheckboxItem>
        {statusOptions.length > 0 && <DropdownMenuSeparator />}
        {statusOptions.map((item) => (
          <DropdownMenuCheckboxItem
            key={item.value}
            checked={statusFilter === item.value}
            onCheckedChange={() => onStatusChange(item.value)}
          >
            {item.label}
          </DropdownMenuCheckboxItem>
        ))}
      </FilterDropdown>

      <FilterDropdown
        label={categoryFilter === "" ? "Category" : categoryFilter}
        activeLabel={categoryFilter === "" ? "All categories" : categoryFilter}
        isActive={categoryFilter !== ""}
        ariaLabel="Filter cases by category"
      >
        <DropdownMenuCheckboxItem
          checked={categoryFilter === ""}
          onCheckedChange={() => onCategoryChange("")}
        >
          All categories
        </DropdownMenuCheckboxItem>
        {categoryOptions.length > 0 && <DropdownMenuSeparator />}
        {categoryOptions.map((item) => (
          <DropdownMenuCheckboxItem
            key={item}
            checked={categoryFilter === item}
            onCheckedChange={() => onCategoryChange(item)}
          >
            {item}
          </DropdownMenuCheckboxItem>
        ))}
      </FilterDropdown>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className={styles.clearBtn} onClick={onClear}>
          <X aria-hidden />
          Show all
        </Button>
      )}
    </div>
  );
}
