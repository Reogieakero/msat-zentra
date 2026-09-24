"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import {
  fetchCoordinatorReferrals,
  fetchCaseMeetings,
  apiErrorMessage,
  stageLabel,
  useNowTick,
  type AdmCaseRow,
  type AdmEligibility,
  type AdmMeeting,
} from "../../components/coordinator-data";
import type { HistoryTarget } from "../../components/CaseHistoryDialog";
import { ELIG_OPTIONS } from "./coordinator-referrals-constants";

export interface CoordinatorReferralsModel
  extends CoordinatorReferralsFilters,
    CoordinatorReferralsSelection,
    CoordinatorReferralsDialogs,
    CoordinatorReferralsActions {
  now: number;
  rows: AdmCaseRow[];
  total: number;
  totalPages: number;
  safePage: number;
  limit: number;
  start: number;
  end: number;
  /** Initial load: no data yet — full page skeleton. */
  isInitialLoading: boolean;
  /** Background sync: data visible, refresh in flight — inline indicator. */
  isSyncing: boolean;
  referralsError: boolean;
  referralsRefetching: boolean;
  refetchReferrals: () => void;
}

interface CoordinatorReferralsFilters {
  query: string;
  setQuery: (v: string) => void;
  debounced: string;
  elig: "all" | AdmEligibility;
  setElig: (v: "all" | AdmEligibility) => void;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  hasActiveFilters: boolean;
  eligMenuLabel: string;
  clearFilters: () => void;
}

interface CoordinatorReferralsSelection {
  selected: AdmCaseRow | null;
  setSelected: (r: AdmCaseRow | null) => void;
  selectedProfileId: string | null;
  meetings: AdmMeeting[];
  meetingsPending: boolean;
  meetingsError: boolean;
  refetchMeetings: () => void;
}

interface CoordinatorReferralsDialogs {
  historyTarget: HistoryTarget | null;
  setHistoryTarget: (t: HistoryTarget | null) => void;
  bookOpen: boolean;
  setBookOpen: (v: boolean) => void;
  bookTarget: AdmCaseRow | null;
  setBookTarget: (r: AdmCaseRow | null) => void;
  outcomeTarget: AdmMeeting | null;
  setOutcomeTarget: (m: AdmMeeting | null) => void;
  outcomeAttended: boolean;
  setOutcomeAttended: (v: boolean) => void;
  outcomeMinutes: string;
  setOutcomeMinutes: (v: string) => void;
  outcomeLogbook: string;
  setOutcomeLogbook: (v: string) => void;
  forwardTarget: AdmCaseRow | null;
  setForwardTarget: (r: AdmCaseRow | null) => void;
  advanceTarget: AdmCaseRow | null;
  setAdvanceTarget: (r: AdmCaseRow | null) => void;
  createTarget: AdmCaseRow | null;
  setCreateTarget: (r: AdmCaseRow | null) => void;
  termId: string;
  setTermId: (v: string) => void;
  terms: { id: string; termNumber: number }[];
}

interface CoordinatorReferralsActions {
  openBook: () => void;
  bookForRow: (row: AdmCaseRow) => void;
  closeBook: () => void;
  openOutcome: (m: AdmMeeting) => void;
  prepareCreate: (row: AdmCaseRow) => Promise<void>;
  prepareCreatePending: boolean;
  closeSheet: () => void;
  advancePending: boolean;
  forwardPending: boolean;
  confirmAdvance: () => void;
  confirmForward: () => void;
  createPending: boolean;
  canCreate: boolean;
  confirmCreate: () => void;
  bookPending: boolean;
  /** Row id currently being booked/rescheduled — other rows stay usable. */
  bookPendingId: string | null;
  bookError: string | null;
  bookMode: "book" | "reschedule";
  rescheduleMeeting: {
    id: string;
    datetime: string;
    venue: string;
    logbook?: string | null;
  } | null;
  confirmBook: (fields: {
    meetingDatetime: string;
    venue: "school" | "home";
    logbook: string;
  }) => void;
  outcomePending: boolean;
  confirmOutcome: () => void;
}

function isEarlyRow(row: AdmCaseRow): boolean {
  return row.id.startsWith("referral:");
}

export function useCoordinatorReferrals(): CoordinatorReferralsModel {
  const queryClient = useQueryClient();
  const now = useNowTick();
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [elig, setElig] = React.useState<"all" | AdmEligibility>("all");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<AdmCaseRow | null>(null);
  const [historyTarget, setHistoryTarget] =
    React.useState<HistoryTarget | null>(null);
  const [bookOpen, setBookOpen] = React.useState(false);
  const [bookTarget, setBookTarget] = React.useState<AdmCaseRow | null>(null);
  const [outcomeTarget, setOutcomeTarget] = React.useState<AdmMeeting | null>(
    null,
  );
  const [outcomeAttended, setOutcomeAttended] = React.useState(true);
  const [outcomeMinutes, setOutcomeMinutes] = React.useState("");
  const [outcomeLogbook, setOutcomeLogbook] = React.useState("");
  const [forwardTarget, setForwardTarget] = React.useState<AdmCaseRow | null>(
    null,
  );
  const [advanceTarget, setAdvanceTarget] = React.useState<AdmCaseRow | null>(
    null,
  );
  const [createTarget, setCreateTarget] = React.useState<AdmCaseRow | null>(
    null,
  );
  const [prepareCreatePending, setPrepareCreatePending] =
    React.useState(false);
  const [termId, setTermId] = React.useState("");
  const [terms, setTerms] = React.useState<{ id: string; termNumber: number }[]>(
    [],
  );

  function openBook() {
    // From the open case sheet — book for the sheet's case. Sheet stays
    // open behind the modal (user already opened it deliberately). The
    // shared dialog starts with a fresh form on every open.
    if (selected) setBookTarget(selected);
    setBookOpen(true);
  }

  function bookForRow(row: AdmCaseRow) {
    // From the table (Meeting column button or 3-dots Schedule meeting) —
    // modal ONLY, never the case sheet. The dialog asks only date/time +
    // venue + optional logbook ref: no student or parent account required.
    // If the row has no profile yet, confirm auto-creates it first.
    setBookTarget(row);
    setBookOpen(true);
  }

  function openOutcome(m: AdmMeeting) {
    setOutcomeTarget(m);
    setOutcomeAttended(m.attended);
    setOutcomeMinutes(m.minutesOfMeeting ?? "");
    setOutcomeLogbook(m.attendanceLogbookRef ?? "");
  }

  function closeSheet() {
    setSelected(null);
    setBookOpen(false);
    setBookTarget(null);
    setOutcomeTarget(null);
  }

  function closeBook() {
    setBookOpen(false);
    setBookTarget(null);
    bookMutation.reset();
  }

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const referralsQuery = useQuery({
    // Eligibility is server-side (backend `eligibility` param) so total /
    // pagination stay truthful when filtering — never filter locally.
    queryKey: ["coordinator-referrals", page, debounced, elig],
    queryFn: ({ signal }) =>
      fetchCoordinatorReferrals(page, {
        q: debounced || undefined,
        eligibility: elig,
        signal,
      }),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const rows = referralsQuery.data?.rows ?? [];

  // Scoped invalidations: booking / outcome touch no dashboard aggregates
  // (stages, KPIs, forms), so they refresh the list + meetings only instead
  // of refetching the heavy dashboard too.
  const invalidateReferrals = () => {
    void queryClient.invalidateQueries({ queryKey: ["coordinator-referrals"] });
  };
  const invalidateAll = () => {
    invalidateReferrals();
    void queryClient.invalidateQueries({ queryKey: ["coordinator-dashboard"] });
  };

  // Advance and forward are separate mutations with separate pending flags
  // so each confirm button reports its own action (Advancing… / Endorsing…).
  const advanceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/api/adm/${id}/stage`, {
        stage: "meeting_parents",
      });
      return data;
    },
    onSuccess: () => {
      invalidateAll();
      setForwardTarget(null);
      setAdvanceTarget(null);
      setSelected(null);
      toast.success({
        title: "Case advanced",
        description: `Case moved to ${stageLabel("meeting_parents")}.`,
      });
    },
    onError: (err) =>
      toast.error({
        title: "Could not update case",
        description: apiErrorMessage(err),
      }),
  });
  const forwardMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/api/adm/${id}/stage`, {
        stage: "principal_approval",
      });
      return data;
    },
    onSuccess: () => {
      invalidateAll();
      setForwardTarget(null);
      setAdvanceTarget(null);
      setSelected(null);
      toast.success({
        title: "Endorsed to Principal",
        description: "The case is now locked awaiting the Principal's signature.",
      });
    },
    onError: (err) =>
      toast.error({
        title: "Could not update case",
        description: apiErrorMessage(err),
      }),
  });

  // Create-profile pre-step: existence check on the targeted case endpoint
  // (no full-list fetch) in parallel with the terms lookup. Tracked with
  // its own pending flag so the button shows Preparing… and double clicks
  // can't fire parallel resolves. studentId is intentionally omitted — the
  // backend derives (or provisions) the student from the referral itself.
  async function prepareCreate(row: AdmCaseRow) {
    if (prepareCreatePending) return;
    setPrepareCreatePending(true);
    try {
      const referralId = row.id.replace(/^referral:/, "");
      const [caseRes, termRes] = await Promise.all([
        apiClient.get(
          `/api/adm/case/${encodeURIComponent(`referral:${referralId}`)}`,
        ),
        apiClient.get("/api/registrar/academics/terms"),
      ]);
      if (!caseRes.data) {
        toast.error({
          title: "Referral not found",
          description: "This referral no longer exists. Refresh the list.",
        });
        return;
      }
      const list = (termRes.data?.terms ?? []) as {
        id: string;
        termNumber: number;
      }[];
      setTerms(list);
      setTermId(list[0]?.id ?? "");
      setCreateTarget({ ...row, studentId: "" });
    } catch (err) {
      toast.error({
        title: "Could not start profile",
        description: apiErrorMessage(err),
      });
    } finally {
      setPrepareCreatePending(false);
    }
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!createTarget) throw new Error("No referral selected.");
      const referralId = createTarget.id.replace(/^referral:/, "");
      const { data } = await apiClient.post("/api/adm/profiles", {
        // Omitted when the referral has no account — the backend derives
        // (or provisions) the student from the referral itself.
        ...(createTarget.studentId
          ? { studentId: createTarget.studentId }
          : {}),
        referralId,
        termId,
      });
      return data;
    },
    onSuccess: () => {
      invalidateAll();
      setCreateTarget(null);
      toast.success({
        title: "Learner profile created",
        description: "The case is now ready for the parent meeting.",
      });
    },
    onError: (err) =>
      toast.error({
        title: "Could not create profile",
        description: apiErrorMessage(err),
      }),
  });

  const selectedProfileId =
    selected && !isEarlyRow(selected) ? selected.id : null;
  const meetingsQuery = useQuery({
    queryKey: ["coordinator-meetings", selectedProfileId],
    queryFn: ({ signal }) =>
      fetchCaseMeetings(selectedProfileId as string, signal),
    enabled: selectedProfileId !== null,
    staleTime: 30_000,
  });
  const meetings = React.useMemo(
    () => meetingsQuery.data ?? [],
    [meetingsQuery.data],
  );

  // A case with a still-booked (unattended) meeting cannot take a second
  // booking — the dialog reschedules that meeting instead. Prefer the live
  // meetings list for the open sheet (profile cases), else fall back to the
  // row's latest-meeting snapshot (covers table rows, incl. early
  // referrals, without an extra fetch).
  const rescheduleMeeting = React.useMemo(() => {
    const target = bookTarget ?? selected;
    if (!target) return null;
    if (selected && target.id === selected.id && meetings.length > 0) {
      const pending = meetings.find((m) => !m.attended);
      if (pending) {
        return {
          id: pending.id,
          datetime: pending.meetingDatetime,
          venue: pending.venue,
          logbook: pending.attendanceLogbookRef,
        };
      }
      return null;
    }
    const rowMeeting = target.meeting ?? null;
    if (rowMeeting && !rowMeeting.attended && rowMeeting.id) {
      return {
        id: rowMeeting.id,
        datetime: rowMeeting.datetime,
        venue: rowMeeting.venue,
      };
    }
    return null;
  }, [bookTarget, selected, meetings]);
  const bookMode = rescheduleMeeting ? ("reschedule" as const) : ("book" as const);

  const bookMutation = useMutation({
    mutationFn: async (fields: {
      meetingDatetime: string;
      venue: "school" | "home";
      logbook: string;
    }) => {
      // Reschedule path: the case already has a booked (unattended)
      // meeting — move it instead of creating a second booking.
      if (rescheduleMeeting) {
        const { data } = await apiClient.patch(
          `/api/adm/meetings/${rescheduleMeeting.id}/reschedule`,
          {
            meetingDatetime: new Date(fields.meetingDatetime).toISOString(),
            venue: fields.venue,
            ...(fields.logbook.trim()
              ? { attendanceLogbookRef: fields.logbook.trim() }
              : {}),
          },
        );
        return { meeting: data, venue: fields.venue, rescheduled: true as const };
      }
      // Book for the modal's target (table row or open sheet case) — the
      // case sheet is never touched here, so table clicks show modal only.
      // Early referral rows book straight onto the referral: no student
      // account, no learner profile, and no parent account required.
      const target = bookTarget ?? selected;
      if (!target) throw new Error("No case selected.");
      const url = isEarlyRow(target)
        ? `/api/adm/referral/${target.id.replace(/^referral:/, "")}/meetings`
        : `/api/adm/${target.id}/meetings`;
      const { data } = await apiClient.post(url, {
        meetingDatetime: new Date(fields.meetingDatetime).toISOString(),
        venue: fields.venue,
        ...(fields.logbook.trim()
          ? { attendanceLogbookRef: fields.logbook.trim() }
          : {}),
      });
      return { meeting: data, venue: fields.venue, rescheduled: false as const };
    },
    onSuccess: ({ venue: bookedVenue, rescheduled }) => {
      void queryClient.invalidateQueries({ queryKey: ["coordinator-meetings"] });
      invalidateReferrals();
      closeBook();
      toast.success({
        title: rescheduled ? "Meeting rescheduled" : "Meeting booked",
        description: rescheduled
          ? bookedVenue === "home"
            ? "Home visitation moved to the new schedule."
            : "In-school meeting moved to the new schedule."
          : bookedVenue === "home"
            ? "Home visitation scheduled."
            : "In-school meeting scheduled.",
      });
    },
    onError: (err) =>
      toast.error({
        title: rescheduleMeeting ? "Could not reschedule meeting" : "Could not book meeting",
        description: apiErrorMessage(err),
      }),
  });

  const outcomeMutation = useMutation({
    mutationFn: async () => {
      if (!outcomeTarget) throw new Error("No meeting selected.");
      const { data } = await apiClient.patch(
        `/api/adm/meetings/${outcomeTarget.id}`,
        {
          attended: outcomeAttended,
          ...(outcomeMinutes.trim()
            ? { minutesOfMeeting: outcomeMinutes.trim() }
            : {}),
          ...(outcomeLogbook.trim()
            ? { attendanceLogbookRef: outcomeLogbook.trim() }
            : {}),
        },
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["coordinator-meetings"] });
      invalidateReferrals();
      setOutcomeTarget(null);
      toast.success({
        title: outcomeAttended ? "Attendance recorded" : "Outcome recorded",
        description: outcomeAttended
          ? "Minutes logged — the case can move to certification."
          : "Marked as not attended — the home visitation path applies.",
      });
    },
    onError: (err) =>
      toast.error({
        title: "Could not record outcome",
        description: apiErrorMessage(err),
      }),
  });

  const hasActiveFilters = debounced !== "" || elig !== "all";
  const eligMenuLabel =
    ELIG_OPTIONS.find((o) => o.value === elig)?.label ?? "All statuses";

  function clearFilters() {
    setQuery("");
    setElig("all");
    setPage(1);
  }

  const total = referralsQuery.data?.total ?? 0;
  const totalPages = referralsQuery.data?.totalPages ?? 1;
  const safePage = Math.min(page, totalPages);
  const limit = referralsQuery.data?.limit ?? 20;
  const start = total === 0 ? 0 : (safePage - 1) * limit + 1;
  const end = Math.min(safePage * limit, total);

  return {
    now,
    rows,
    total,
    totalPages,
    safePage,
    limit,
    start,
    end,
    isInitialLoading: referralsQuery.isPending,
    isSyncing: referralsQuery.isFetching && !referralsQuery.isPending,
    referralsError: referralsQuery.isError || !referralsQuery.data,
    referralsRefetching: referralsQuery.isRefetching,
    refetchReferrals: () => {
      void referralsQuery.refetch();
    },
    query,
    setQuery,
    debounced,
    elig,
    setElig: (v: "all" | AdmEligibility) => {
      setElig(v);
      setPage(1);
    },
    page,
    setPage,
    hasActiveFilters,
    eligMenuLabel,
    clearFilters,
    selected,
    setSelected,
    selectedProfileId,
    meetings,
    meetingsPending: meetingsQuery.isPending,
    meetingsError: meetingsQuery.isError,
    refetchMeetings: () => {
      void meetingsQuery.refetch();
    },
    historyTarget,
    setHistoryTarget,
    bookOpen,
    setBookOpen,
    bookTarget,
    setBookTarget,
    outcomeTarget,
    setOutcomeTarget,
    outcomeAttended,
    setOutcomeAttended,
    outcomeMinutes,
    setOutcomeMinutes,
    outcomeLogbook,
    setOutcomeLogbook,
    forwardTarget,
    setForwardTarget,
    advanceTarget,
    setAdvanceTarget,
    createTarget,
    setCreateTarget,
    termId,
    setTermId,
    terms,
    openBook,
    bookForRow,
    closeBook,
    openOutcome,
    prepareCreate,
    prepareCreatePending,
    closeSheet,
    advancePending: advanceMutation.isPending,
    forwardPending: forwardMutation.isPending,
    confirmAdvance: () => {
      if (advanceTarget && !isEarlyRow(advanceTarget) && !advanceMutation.isPending) {
        advanceMutation.mutate(advanceTarget.id);
      }
    },
    confirmForward: () => {
      if (forwardTarget && !isEarlyRow(forwardTarget) && !forwardMutation.isPending) {
        forwardMutation.mutate(forwardTarget.id);
      }
    },
    createPending: createMutation.isPending,
    canCreate: Boolean(termId) && !createMutation.isPending,
    confirmCreate: () => {
      if (!createMutation.isPending) createMutation.mutate();
    },
    bookPending: bookMutation.isPending,
    bookPendingId: bookMutation.isPending ? (bookTarget?.id ?? selected?.id ?? null) : null,
    bookError: bookMutation.error ? apiErrorMessage(bookMutation.error) : null,
    bookMode,
    rescheduleMeeting,
    confirmBook: (fields: {
      meetingDatetime: string;
      venue: "school" | "home";
      logbook: string;
    }) => {
      if (!bookMutation.isPending) bookMutation.mutate(fields);
    },
    outcomePending: outcomeMutation.isPending,
    confirmOutcome: () => {
      if (!outcomeMutation.isPending) outcomeMutation.mutate();
    },
  };
}
