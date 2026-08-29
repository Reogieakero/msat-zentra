import * as React from "react";
import { ChevronDown, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AuditActionType,
  ACTION_TYPES,
  ACTOR_ROLES,
  ROLE_LABELS,
  AuditRole,
} from "../audit-data";
import styles from "./audit-toolbar.module.css";

export type ActorScope = "all" | "me";

function FilterDropdown({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onSelect: (v: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={styles.dropdown}>
          <span className={styles.dropdownLabel}>{label}:</span>
          <span className={styles.dropdownValue}>{value}</span>
          <ChevronDown className={styles.dropdownChevron} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={styles.menu}>
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            className={styles.menuItem}
            onSelect={() => onSelect(o.value)}
          >
            <span className={styles.menuCheck}>{o.value === value ? <Check className={styles.checkIcon} /> : null}</span>
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AuditToolbar({
  actionType,
  onActionTypeChange,
  actorRole,
  onActorRoleChange,
  actorScope,
  onActorScopeChange,
  sourceTable,
  onSourceTableChange,
  sourceTables,
  query,
  onQueryChange,
  onExport,
}: {
  actionType: AuditActionType | "all";
  onActionTypeChange: (v: AuditActionType | "all") => void;
  actorRole: AuditRole | "all";
  onActorRoleChange: (v: AuditRole | "all") => void;
  actorScope: ActorScope;
  onActorScopeChange: (v: ActorScope) => void;
  sourceTable: string | "all";
  onSourceTableChange: (v: string | "all") => void;
  sourceTables: string[];
  query: string;
  onQueryChange: (v: string) => void;
  onExport: () => void;
}) {
  const scopeOptions = [
    { value: "all", label: "Everyone" },
    { value: "me", label: "Actions by me" },
  ];
  const roleOptions = [
    { value: "all", label: "All roles" },
    ...ACTOR_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
  ];
  const actionOptions = [
    { value: "all", label: "All actions" },
    ...ACTION_TYPES.map((a) => ({ value: a.value, label: a.label })),
  ];
  const sourceOptions = [
    { value: "all", label: "All tables" },
    ...sourceTables.map((t) => ({ value: t, label: t })),
  ];

  const scopeValue = scopeOptions.find((o) => o.value === actorScope)?.label ?? "Everyone";
  const roleValue = roleOptions.find((o) => o.value === actorRole)?.label ?? "All roles";
  const actionValue = actionOptions.find((o) => o.value === actionType)?.label ?? "All actions";
  const sourceValue = sourceOptions.find((o) => o.value === sourceTable)?.label ?? "All tables";

  return (
    <div className={styles.toolbar}>
      <div className={styles.filters}>
        <FilterDropdown label="Actor" value={scopeValue} options={scopeOptions} onSelect={(v) => onActorScopeChange(v as ActorScope)} />
        <FilterDropdown label="Role" value={roleValue} options={roleOptions} onSelect={(v) => onActorRoleChange(v as AuditRole | "all")} />
        <FilterDropdown label="Action" value={actionValue} options={actionOptions} onSelect={(v) => onActionTypeChange(v as AuditActionType | "all")} />
        <FilterDropdown label="Source" value={sourceValue} options={sourceOptions} onSelect={(v) => onSourceTableChange(v)} />

        <Input
          placeholder="Search user / reason / id…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className={styles.search}
        />
      </div>

      <div className={styles.actions}>
        <Button size="sm" variant="outline" onClick={onExport}>
          <DownloadIcon />
          Export CSV
        </Button>
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}
