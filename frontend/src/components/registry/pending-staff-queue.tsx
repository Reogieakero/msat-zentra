"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Check, Loader2, Search, X } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { RowList, type RowListItem } from "@/components/ui/row-list";
import { RowListSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";

/**
 * Self-registered teacher accounts awaiting approval. Teachers sign up through
 * `/register/teacher` or the staff Google portal; both accounts desks (G7–10
 * record keeper and G11–12 registrar) see the same unbanded queue. Approval is
 * the administrator's call — the principal is not part of this flow.
 */

type PendingStaffRow = {
  id: string;
  role?: string;
  name: string;
  email: string;
  contactNumber: string;
  employeeId?: string | null;
  department?: string | null;
  requestedAt: string;
};

type PendingStaffResponse = {
  students: PendingStaffRow[];
  total?: number;
  page?: number;
};

function fetchPendingStaff(page: number, signal?: AbortSignal): Promise<PendingStaffResponse> {
  return apiClient
    .get<PendingStaffResponse>("/api/auth/pending", {
      params: { role: "staff", page, pageSize: PAGE_SIZE },
      signal,
    })
    .then((res) => res.data);
}

/** Shared queue total so a page's "truly empty" state stays honest when a
 *  teacher request is waiting (same query key as page 1 of the queue). */
export function usePendingStaffTotal(desk: "registrar" | "record_keeper"): number {
  const { data } = useQuery({
    queryKey: ["pending-staff", desk, 1],
    queryFn: ({ signal }) => fetchPendingStaff(1, signal),
  });
  return data?.total ?? data?.students.length ?? 0;
}

const ROLE_LABEL: Record<string, string> = {
  subject_teacher: "Subject Teacher",
  adviser: "Adviser",
};

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const min = Math.round((Date.now() - then) / 60_000);
  if (min < 60) return `${Math.max(0, min)}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

function messageOf(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response
      ?.data?.error?.message ??
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    "Could not process this account. Try again."
  );
}

export function PendingStaffQueue({ desk }: { desk: "registrar" | "record_keeper" }) {
  const qc = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [queryInput, setQueryInput] = React.useState("");
  const [rejectTarget, setRejectTarget] = React.useState<PendingStaffRow | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");

  const { data, isPending, isError } = useQuery({
    queryKey: ["pending-staff", desk, page],
    queryFn: ({ signal }) => fetchPendingStaff(page, signal),
  });
  const act = useMutation({
    mutationFn: ({ id, approve, reason }: { id: string; approve: boolean; reason?: string; name: string }) =>
      apiClient.post(approve ? `/api/auth/approve/${id}` : `/api/auth/reject/${id}`, approve ? {} : { reason }),
    onSuccess: (_data, { approve, name }) => {
      toast.success({
        title: approve ? "Approved" : "Rejected",
        description: approve ? `${name} can sign in now.` : `${name}'s request was rejected.`,
      });
    },
    onError: (err) => toast.error({ title: "Action failed", description: messageOf(err) }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["pending-staff"] });
      qc.invalidateQueries({ queryKey: ["pending-students"] });
      qc.invalidateQueries({ queryKey: ["record-keeper-pending-students"] });
      qc.invalidateQueries({ queryKey: ["account-breakdown"] });
      qc.invalidateQueries({ queryKey: ["record-keeper-account-breakdown"] });
    },
  });

  const rows = React.useMemo(() => data?.students ?? [], [data]);
  const total = data?.total ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Clamp for display/requests instead of setState-in-effect; the server also
  // clamps out-of-range pages.
  const safePage = Math.min(page, totalPages);

  const visibleRows = React.useMemo(() => {
    const q = queryInput.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.name} ${r.email}`.toLowerCase().includes(q));
  }, [rows, queryInput]);

  const rowItems = React.useMemo<RowListItem[]>(
    () =>
      visibleRows.map((r) => ({
        key: r.id,
        status: { label: "Pending", tone: "amber" },
        title: r.name,
        idLabel: ROLE_LABEL[r.role ?? ""] ?? "Teacher",
        idLabelClassName: "text-[11px] font-medium",
        meta: [
          { label: r.department ?? r.email, tone: "muted", dot: false, title: r.department ? `${r.department} — ${r.email}` : r.email },
          ...(r.employeeId
            ? [{ label: `ID ${r.employeeId}`, tone: "amber" as const, dot: false }]
            : []),
          ...(r.contactNumber && r.contactNumber !== "—"
            ? [{ label: r.contactNumber, tone: "muted" as const, dot: false }]
            : []),
          { label: formatRelativeTime(r.requestedAt), tone: "muted", dot: false },
        ],
        ariaLabel: `${r.name}, pending teacher account`,
        actions: (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              className="h-6 gap-1 border border-transparent bg-emerald-600 px-2 text-[11px] font-medium text-white shadow-none hover:bg-emerald-700"
              disabled={act.isPending}
              onClick={() => act.mutate({ id: r.id, approve: true, name: r.name })}
              aria-label={`Approve ${r.name}`}
            >
              {act.isPending && act.variables?.id === r.id && act.variables.approve ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Check className="size-3.5" aria-hidden />
              )}
              Approve
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 gap-1 px-2 text-[11px] font-medium shadow-none"
              disabled={act.isPending}
              onClick={() => {
                setRejectReason("");
                setRejectTarget(r);
              }}
              aria-label={`Reject ${r.name}`}
            >
              <X className="size-3.5" aria-hidden />
              Reject
            </Button>
          </div>
        ),
      })),
    [visibleRows, act],
  );

  return (
    <>
      <KanbanBoard
        title="Pending Teachers"
        icon={<Briefcase size={14} className="text-primary" aria-hidden />}
        description="Self-registered teacher accounts awaiting administrator approval."
        ariaLabel="Pending teacher accounts"
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              className="h-8 w-56 pl-7 text-sm"
              placeholder="Search name or email…"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              aria-label="Search pending teachers"
            />
          </div>
        }
        footer={
          total > PAGE_SIZE ? (
            <Pagination currentPage={safePage} totalItems={total} onPageChange={setPage} />
          ) : undefined
        }
      >
        {isPending ? (
          <RowListSkeleton rows={4} gutter="0.625rem" withMetaAvatar={false} withActions metaPills={2} />
        ) : isError ? (
          <p className="py-4 text-sm text-muted-foreground">Could not load pending teachers.</p>
        ) : visibleRows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            {queryInput.trim()
              ? `No pending teachers match “${queryInput.trim()}”.`
              : "No teacher accounts are waiting for approval."}
          </p>
        ) : (
          <RowList
            bleed
            gutter="0.625rem"
            animateOnMount
            motionPreset="desk"
            items={rowItems}
            emptyText="No pending teacher accounts."
            ariaLabel="Pending teacher accounts"
          />
        )}
      </KanbanBoard>

      <KanbanOverlay
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        title="Reject account request"
        description={
          rejectTarget ? `Tell ${rejectTarget.name} why the request was not approved.` : undefined
        }
        icon={<X size={14} className="text-red-500" aria-hidden />}
        busy={act.isPending}
        dismissable={!act.isPending}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={act.isPending}
              onClick={() => setRejectTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={act.isPending || rejectReason.trim().length === 0}
              onClick={() => {
                const target = rejectTarget;
                if (!target) return;
                act.mutate(
                  { id: target.id, approve: false, reason: rejectReason.trim(), name: target.name },
                  { onSuccess: () => setRejectTarget(null) },
                );
              }}
            >
              {act.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              Reject request
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="staff-reject-reason" className="text-sm font-medium">
            Reason
          </label>
          <Textarea
            id="staff-reject-reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Not on the school's teacher roster for this school year."
            rows={3}
          />
        </div>
      </KanbanOverlay>
    </>
  );
}
