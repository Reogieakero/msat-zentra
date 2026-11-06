import * as React from "react";
import {
  ChevronDown,
  Search,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ACTION_TYPES,
  ACTOR_ROLES,
  ROLE_LABELS,
  type AuditActionType,
  type AuditRole,
} from "@/services/principal/audit.types";
import styles from "./audit-toolbar.module.css";

export type ActorScope = "all" | "me";

function FilterDropdown({
  label,
  active,
  items,
  allLabel,
  onSelect,
  grouped,
}: {
  label: string;
  active: string;
  activeLabel?: string;
  items: { value: string; label: string }[];
  allLabel: string;
  onSelect: (v: string) => void;
  grouped?: { label: string; items: { value: string; label: string }[] }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`${styles.filterBtn} ${active !== "all" ? styles.filterActive : ""}`}
        >
          {label}
          {active !== "all" && (
            <span className={styles.filterDot} aria-hidden />
          )}
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={styles.menu}
        style={{
          width: "auto",
          minWidth: "var(--radix-dropdown-menu-trigger-width)",
          maxWidth: "min(24rem, 90vw)",
        }}
      >
        <DropdownMenuCheckboxItem
          checked={active === "all"}
          onCheckedChange={() => onSelect("all")}
        >
          {allLabel}
        </DropdownMenuCheckboxItem>
        {grouped
          ? grouped.map((group) => (
              <React.Fragment key={group.label}>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                {group.items.map((i) => (
                  <DropdownMenuCheckboxItem
                    key={i.value}
                    checked={active === i.value}
                    onCheckedChange={() => onSelect(i.value)}
                  >
                    {i.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </React.Fragment>
            ))
          : items.map((i) => (
              <DropdownMenuCheckboxItem
                key={i.value}
                checked={active === i.value}
                onCheckedChange={() => onSelect(i.value)}
              >
                {i.label}
              </DropdownMenuCheckboxItem>
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
  exporting = false,
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
  exporting?: boolean;
}) {
  const scopeItems = [
    { value: "all", label: "Everyone" },
    { value: "me", label: "Actions by me" },
  ];
  const roleItems = [
    { value: "all", label: "All roles" },
    ...ACTOR_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
  ];
  const actionItems = [
    { value: "all", label: "All actions" },
    ...ACTION_TYPES.map((a) => ({ value: a.value, label: a.label })),
  ];
  const sourceItems = [
    { value: "all", label: "All tables" },
    ...sourceTables.map((t) => ({ value: t, label: t })),
  ];

  return (
    <div className={styles.toolbar}>
      <div className={styles.searchWrap}>
        <Search className={styles.searchIcon} aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search user, reason, or id…"
          className={styles.search}
          aria-label="Search audit entries"
        />
      </div>

      <FilterDropdown
        label="Actor"
        active={actorScope}
        items={scopeItems}
        allLabel="Everyone"
        onSelect={(v) => onActorScopeChange(v as ActorScope)}
      />
      <FilterDropdown
        label="Role"
        active={actorRole}
        items={roleItems}
        allLabel="All roles"
        onSelect={(v) => onActorRoleChange(v as AuditRole | "all")}
      />
      <FilterDropdown
        label="Action"
        active={actionType}
        items={actionItems}
        allLabel="All actions"
        onSelect={(v) => onActionTypeChange(v as AuditActionType | "all")}
      />
      <FilterDropdown
        label="Source"
        active={sourceTable}
        items={sourceItems}
        allLabel="All tables"
        onSelect={(v) => onSourceTableChange(v)}
      />

      <Button size="sm" variant="outline" onClick={onExport} disabled={exporting} aria-busy={exporting}>
        {exporting ? <Spinner className="size-4" aria-hidden /> : <Download aria-hidden />}
        {exporting ? "Exporting…" : "Export CSV"}
      </Button>
    </div>
  );
}
