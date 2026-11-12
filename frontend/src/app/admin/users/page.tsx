"use client";

import * as React from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  Loader2,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InsightCallout } from "@/components/ui/insight-callout";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { toast } from "@/components/ui/sonner";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { RowList, type RowListItem, type RowTone } from "@/components/ui/row-list";
import { RowListSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { ZentraPageHeader } from "@/components/shared/zentra-page-header/ZentraPageHeader";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";
import { useUrlPager } from "@/components/shared/pagination/useUrlPager";
import { roleLabel, ROLES } from "@/lib/auth/roles";
import {
  fetchAdminUsers,
  updateAdminUserStatus,
  type AdminUser,
} from "@/services/admin/admin.service";
import styles from "./users.module.css";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Status → kanban row tone (green / amber / red). */
const STATUS_TONE: Record<string, RowTone> = {
  active: "green",
  pending: "amber",
  suspended: "red",
};

/** Role → kanban row tone, grouped by the presence legend's colour families. */
const ROLE_TONE: Record<string, RowTone> = {
  student: "blue",
  parent: "blue",
  subject_teacher: "amber",
  adviser: "amber",
  nurse: "red",
  adm_coordinator: "red",
  guidance_counselor: "green",
  record_keeper: "amber",
  registrar: "blue",
  principal: "red",
  admin: "green",
};

/** Filter button + checkbox dropdown menu (same pattern as the audit desk). */
function FilterMenu({
  label,
  active,
  items,
  allLabel,
  onSelect,
}: {
  label: string;
  active: string;
  items: { value: string; label: string }[];
  allLabel: string;
  onSelect: (value: string) => void;
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
          {active !== "all" ? <span className={styles.filterDot} aria-hidden /> : null}
          <ChevronDown size={14} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={styles.filterMenu}
      >
        <DropdownMenuCheckboxItem
          checked={active === "all"}
          onCheckedChange={() => onSelect("all")}
        >
          {allLabel}
        </DropdownMenuCheckboxItem>
        {items.map((item) => (
          <DropdownMenuCheckboxItem
            key={item.value}
            checked={active === item.value}
            onCheckedChange={() => onSelect(item.value)}
          >
            {item.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function AdminUsersPage() {
  return (
    <React.Suspense>
      <AdminUsersPageInner />
    </React.Suspense>
  );
}

function AdminUsersPageInner() {
  const queryClient = useQueryClient();
  const [queryInput, setQueryInput] = React.useState("");
  const [role, setRole] = React.useState("");
  const [status, setStatus] = React.useState("");

  const pager = useUrlPager(0, {}, { extraParams: ["role", "status"] });

  // Role / status are server filters — keep them in the URL without clobbering
  // one another. The search box filters the loaded rows instantly (no fetch).
  React.useEffect(() => {
    pager.setFilters({
      role: role || undefined,
      status: status || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, status]);

  const query = useQuery({
    queryKey: ["admin", "users", pager.page, role, status],
    queryFn: ({ signal }) =>
      fetchAdminUsers({
        page: pager.page,
        pageSize: PAGE_SIZE,
        role: role || undefined,
        status: status || undefined,
        signal,
      }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const total = query.data?.total ?? 0;
  const rows = React.useMemo(() => query.data?.data ?? [], [query.data]);

  const searching = queryInput.trim().length > 0;

  // Instant local filter over the loaded page — typing never hits the network.
  const visibleRows = React.useMemo(() => {
    const q = queryInput.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((user) =>
      `${user.fullName} ${user.email} ${roleLabel(user.role)}`.toLowerCase().includes(q),
    );
  }, [rows, queryInput]);

  const statusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: "active" | "suspended" }) =>
      updateAdminUserStatus(id, next),
    onSuccess: (updated) => {
      toast.success({
        title: "Account updated",
        description: `The account is now ${updated.status}.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
    onError: (error) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Could not update the account.";
      toast.error({ title: "Update failed", description: message });
    },
  });

  const actingId = statusMutation.isPending ? statusMutation.variables?.id : undefined;

  const rowItems = React.useMemo<RowListItem[]>(
    () =>
      visibleRows.map((user: AdminUser) => ({
        key: user.id,
        status: {
          label: user.status.charAt(0).toUpperCase() + user.status.slice(1),
          tone: STATUS_TONE[user.status] ?? "muted",
        },
        statusTitle: "Account status",
        title: user.fullName,
        idLabel: user.email,
        idLabelTitle: "Email",
        idLabelClassName: "text-[11px] font-medium",
        leadPill: {
          label: roleLabel(user.role),
          tone: ROLE_TONE[user.role] ?? "muted",
          title: "Role",
        },
        meta: [
          {
            label: formatDate(user.createdAt),
            tone: "muted",
            dot: false,
            title: `Created ${new Date(user.createdAt).toLocaleString()}`,
          },
        ],
        avatarMascot: {
          name: user.fullName,
          seed: user.id,
          character: user.mascot,
        },
        ariaLabel: `${user.fullName}, ${roleLabel(user.role)}, ${user.status} account`,
        actions: (
          <span className={styles.rowAction}>
            {user.role === "admin" || user.status === "pending" ? (
              <span className={styles.muted}>—</span>
            ) : user.status === "suspended" ? (
              <button
                type="button"
                className={styles.actionBtn}
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ id: user.id, next: "active" })}
              >
                {actingId === user.id ? (
                  <Loader2 size={12} className={styles.spin} aria-hidden="true" />
                ) : (
                  <UserCheck size={12} aria-hidden="true" />
                )}
                Restore
              </button>
            ) : (
              <button
                type="button"
                className={styles.actionBtnDanger}
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ id: user.id, next: "suspended" })}
              >
                {actingId === user.id ? (
                  <Loader2 size={12} className={styles.spin} aria-hidden="true" />
                ) : (
                  <UserX size={12} aria-hidden="true" />
                )}
                Suspend
              </button>
            )}
          </span>
        ),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleRows, actingId, statusMutation.isPending],
  );

  return (
    <section className={styles.page}>
      <ZentraPageHeader
        title="User accounts"
        description="Every account in Zentra. Suspend or restore access; pending sign-ups are approved at the registrar or record keeper desk."
      />

      <KanbanBoard
        title="User accounts"
        icon={<Users size={14} className="text-primary" aria-hidden />}
        description="Search every account, filter by role or status, then suspend or restore access."
        ariaLabel="User accounts"
        headerToolbar={
          <>
            <InputGroup className="w-56 max-w-full rounded-[16px]">
              <InputGroupInput
                placeholder="Filter accounts..."
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                aria-label="Filter accounts"
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
            </InputGroup>

            <FilterMenu
              label="Role"
              active={role || "all"}
              allLabel="All roles"
              items={ROLES.map((r) => ({ value: r, label: roleLabel(r) }))}
              onSelect={(v) => setRole(v === "all" ? "" : v)}
            />

            <FilterMenu
              label="Status"
              active={status || "all"}
              allLabel="All statuses"
              items={[
                { value: "active", label: "Active" },
                { value: "pending", label: "Pending" },
                { value: "suspended", label: "Suspended" },
              ]}
              onSelect={(v) => setStatus(v === "all" ? "" : v)}
            />
          </>
        }
        footer={
          <Pagination
            currentPage={pager.page}
            totalItems={total}
            pageSize={PAGE_SIZE}
            onPageChange={pager.setPage}
          />
        }
      >
        {query.isPending ? (
          <RowListSkeleton
            rows={PAGE_SIZE}
            gutter="0.625rem"
            hasLead
            withMetaAvatar={false}
            withActions
            metaPills={1}
          />
        ) : query.isError ? (
          <p className={styles.empty}>
            Could not load accounts.{" "}
            <button type="button" className={styles.inlineBtn} onClick={() => void query.refetch()}>
              Retry
            </button>
          </p>
        ) : searching && visibleRows.length === 0 ? (
          <div className="flex w-full justify-center py-4">
            <InsightCallout role="status" className="w-full max-w-xl text-left">
              <strong>No accounts match &ldquo;{queryInput.trim()}&rdquo;.</strong> Try a
              different name or email — or clear the filter to see every account.
            </InsightCallout>
          </div>
        ) : rows.length === 0 ? (
          <p className={styles.empty}>No accounts match these filters.</p>
        ) : (
          <RowList
            bleed
            gutter="0.625rem"
            animateOnMount
            motionPreset="desk"
            items={rowItems}
            emptyText="No accounts match these filters."
            ariaLabel="User accounts"
          />
        )}
      </KanbanBoard>

      {role === "admin" ? (
        <p className={styles.note}>
          <ShieldCheck size={14} aria-hidden="true" /> Administrator accounts are protected and
          cannot be suspended from this console.
        </p>
      ) : null}
    </section>
  );
}
