"use client";

import * as React from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { refreshBookingReminders } from "@/components/notifications/BookingReminderStack";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { markSelfNotified } from "@/lib/realtime/coordinatorChannel";
import {
  fetchCoordinatorReferrals,
  fetchCaseMeetings,
  fetchCoordinatorCaseDetail,
  apiErrorMessage,
  inviteeToAttendee,
  stageLabel,
  useNowTick,
  type AdmCaseRow,
  type AdmEligibility,
  type AdmMeeting,
  type AdmMeetingInvitee,
} from "../../components/coordinator-data";
import type { HistoryTarget } from "../../components/CaseHistoryDialog";
import { useTerm } from "@/lib/term/TermContext";
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
  /** Queue-wide pipeline counts served with the list response (unaffected
      by the eligibility filter — the page stays truthful while filtering). */
  stageCounts: Record<string, number>;
  totalReferred: number;
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
  /** Checked invitee ids for the invitee attendance checklist. */
  outcomeInviteeIds: string[];
  setOutcomeInviteeIds: (v: string[]) => void;
  closeOutcome: () => void;
  forwardTarget: AdmCaseRow | null;
  setForwardTarget: (r: AdmCaseRow | null) => void;
  advanceTarget: AdmCaseRow | null;
  setAdvanceTarget: (r: AdmCaseRow | null) => void;
  createTarget: AdmCaseRow | null;
  setCreateTarget: (r: AdmCaseRow | null) => void;
  /** Session's active term — profiles are filed under it, never picked here. */
  termId: string;
  scopeLabel: string;
}

interface CoordinatorReferralsActions {
  openBook: () => void;
  bookForRow: (row: AdmCaseRow) => void;
  closeBook: () => void;
  openOutcome: (m: AdmMeeting, row?: AdmCaseRow | null) => void;
  /** Venue preset for a fresh booking (home-visit follow-up after a
      no-show). Cleared whenever the book dialog closes. */
  bookVenuePreset: "school" | "home" | null;
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
    invitees?: { id: string; fullName?: string; role?: string }[];
  } | null;
  confirmBook: (fields: {
    meetingDatetime: string;
    venue: "school" | "home";
    logbook: string;
    inviteeIds: string[];
  }) => void;
  outcomePending: boolean;
  confirmOutcome: () => void;
}

function isEarlyRow(row: AdmCaseRow): boolean {
  return row.id.startsWith("referral:");
}

/* Desk-level pagination standard: full list pages = 15. */
export const COORDINATOR_PAGE_SIZE = 15;

export function useCoordinatorReferrals(): CoordinatorReferralsModel {
  const queryClient = useQueryClient();
  const now = useNowTick();
  const [queryInput, setQueryInput] = React.useState("");
  // Debounced 300ms server search (registrar precedent).
  const debounced = useDebouncedValue(queryInput.trim(), 300);
  const [elig, setElig] = React.useState<"all" | AdmEligibility>("all");
  const [page, setPage] = React.useState(1);
  const setQuery = React.useCallback(
    (v: string) => {
      setQueryInput(v);
      setPage(1);
    },
    [],
  );
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
  const [outcomeInviteeIds, setOutcomeInviteeIds] = React.useState<string[]>([]);
  const [outcomeRow, setOutcomeRow] = React.useState<AdmCaseRow | null>(null);
  const [bookVenuePreset, setBookVenuePreset] = React.useState<"school" | "home" | null>(null);
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
  // Global session scope (Login → select → active term). Profiles are filed
  // under it automatically — no per-action term picker.
  const { activeTerm } = useTerm();
  const termId = activeTerm?.termId ?? "";
  const scopeLabel = activeTerm
    ? `${activeTerm.schoolYearName} · Term ${activeTerm.termNumber}`
    : "No active term";

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

  function openOutcome(m: AdmMeeting, row?: AdmCaseRow | null) {
    setOutcomeRow(row ?? null);
    setOutcomeTarget(m);
    setOutcomeAttended(m.attended);
    setOutcomeMinutes(m.minutesOfMeeting ?? "");
    setOutcomeLogbook(m.attendanceLogbookRef ?? "");
    // Prefill the invitee checklist from previously recorded attendance
    // (entries linked by userId); otherwise start unchecked.
    const recorded = new Set(
      (m.attendees ?? []).map((a) => a.userId).filter((v): v is string => !!v),
    );
    setOutcomeInviteeIds((m.invitees ?? []).map((u) => u.id).filter((id) => recorded.has(id)));
  }

  function closeOutcome() {
    setOutcomeTarget(null);
    setOutcomeInviteeIds([]);
  }

  function closeSheet() {
    setSelected(null);
    setBookOpen(false);
    setBookTarget(null);
    closeOutcome();
  }

  function closeBook() {
    setBookOpen(false);
    setBookTarget(null);
    setBookVenuePreset(null);
    bookMutation.reset();
  }

  const referralsQuery = useQuery({
    // Eligibility is server-side (backend `eligibility` param) so total /
    // pagination stay truthful when filtering — never filter locally.
    // Strict 15 rows per page (desk standard); page turns keep previous data
    // so they never flash skeletons.
    queryKey: ["coordinator-referrals", page, debounced, elig, COORDINATOR_PAGE_SIZE],
    queryFn: ({ signal }) =>
      fetchCoordinatorReferrals(page, {
        q: debounced || undefined,
        eligibility: elig,
        limit: COORDINATOR_PAGE_SIZE,
        signal,
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  // Defensive: the endpoint has returned non-array payloads (cached/error
  // shapes) in the wild — never let rows.reduce crash consumers.
  const rows = Array.isArray(referralsQuery.data?.rows)
    ? referralsQuery.data.rows
    : [];

  // Scoped invalidations: booking / outcome touch no dashboard aggregates
  // (stages, KPIs, forms), so they refresh the list + meetings only instead
  // of refetching the heavy dashboard too.
  const invalidateReferrals = () => {
    void queryClient.invalidateQueries({ queryKey: ["coordinator-referrals"] });
    void queryClient.invalidateQueries({ queryKey: ["coordinator-notifications"] });
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
    onSuccess: (data, id) => {
      void data;
      // Kill the echo toast; bell row still lands. Badge bumps via the
      // ["coordinator-notifications"] invalidate below.
      markSelfNotified(id);
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
    onSuccess: (data, id) => {
      void data;
      markSelfNotified(id);
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

  // Create-profile pre-step: existence check on the targeted case endpoint.
  // Tracked with its own pending flag so the button shows Preparing… and
  // double clicks can't fire parallel resolves. studentId is intentionally
  // omitted — the backend derives (or provisions) the student from the
  // referral itself, and files the profile under the session's active term.
  async function prepareCreate(row: AdmCaseRow) {
    if (prepareCreatePending) return;
    setPrepareCreatePending(true);
    try {
      const referralId = row.id.replace(/^referral:/, "");
      const caseRes = await apiClient.get(
        `/api/adm/case/${encodeURIComponent(`referral:${referralId}`)}`,
      );
      if (!caseRes.data) {
        toast.error({
          title: "Referral not found",
          description: "This referral no longer exists. Refresh the list.",
        });
        return;
      }
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
    onSuccess: (data) => {
      const newId =
        typeof (data as { id?: unknown })?.id === "string"
          ? (data as { id: string }).id
          : null;
      if (newId) markSelfNotified(newId);
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
  // Early referral rows have no profile, but their booked meetings still
  // need to show live in the case sheet — resolve them through the case
  // detail endpoint (which serves `referral:<id>` rows with full meeting
  // fields: attendees, invitees, attachments).
  const earlyRowId = selected && isEarlyRow(selected) ? selected.id : null;
  const meetingsKey = selectedProfileId ?? earlyRowId;
  const meetingsQuery = useQuery({
    queryKey: ["coordinator-meetings", meetingsKey],
    queryFn: async ({ signal }) => {
      if (selectedProfileId) return fetchCaseMeetings(selectedProfileId, signal);
      const detail = await fetchCoordinatorCaseDetail(earlyRowId as string, signal);
      return detail.meetings.map((m) => ({
        id: m.id,
        meetingDatetime: m.meetingDatetime,
        venue: m.venue,
        attended: m.attended,
        parentConfirmedAt: m.parentConfirmedAt,
        minutesOfMeeting: m.minutesOfMeeting,
        attendanceLogbookRef: m.attendanceLogbookRef,
        attendees: m.attendees,
        invitees: m.invitees ?? [],
        attachments: m.attachments ?? [],
        recordedBy: m.recordedBy,
      }));
    },
    enabled: meetingsKey !== null,
    staleTime: 30_000,
  });
  const meetings = React.useMemo(
    () => meetingsQuery.data ?? [],
    [meetingsQuery.data],
  );

  // A case with a still-booked (unattended) meeting cannot take a second
  // booking — the dialog reschedules that meeting instead. Prefer the live
  // meetings list for the open sheet (profile and early rows), else fall
  // back to the row's latest-meeting snapshot (covers the table row menu
  // without an extra fetch).
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
          invitees: pending.invitees,
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
        invitees: (rowMeeting.inviteeIds ?? []).map((id) => ({ id })),
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
      inviteeIds: string[];
    }) => {
      // Reschedule path: the case already has a booked (unattended)
      // meeting — move it instead of creating a second booking. The invite
      // list rides along (omitted only when the dialog never knew it, which
      // cannot happen — both prefill sources carry it).
      if (rescheduleMeeting) {
        const { data } = await apiClient.patch(
          `/api/adm/meetings/${rescheduleMeeting.id}/reschedule`,
          {
            meetingDatetime: new Date(fields.meetingDatetime).toISOString(),
            venue: fields.venue,
            ...(fields.logbook.trim()
              ? { attendanceLogbookRef: fields.logbook.trim() }
              : {}),
            inviteeIds: fields.inviteeIds,
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
        ...(fields.inviteeIds.length > 0 ? { inviteeIds: fields.inviteeIds } : {}),
      });
      return { meeting: data, venue: fields.venue, rescheduled: false as const };
    },
    onSuccess: ({ meeting, venue: bookedVenue, rescheduled }) => {
      const meetingId =
        typeof (meeting as { id?: unknown })?.id === "string"
          ? (meeting as { id: string }).id
          : null;
      if (meetingId) markSelfNotified(meetingId);
      void queryClient.invalidateQueries({ queryKey: ["coordinator-meetings"] });
      invalidateReferrals();
      // A newly booked (or moved) meeting enters reminder evaluation now
      // instead of waiting for the next 30-second tick.
      refreshBookingReminders();
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
      // Merge the invitee checklist into the stored attendees: free-text
      // entries are preserved, invitee-linked entries are replaced by the
      // checked set. Skipped for missed meetings (previous record stands).
      const byId = new Map((outcomeTarget.invitees ?? []).map((u) => [u.id, u]));
      const kept = (outcomeTarget.attendees ?? []).filter((a) => !a.userId);
      const checked = outcomeInviteeIds
        .map((id) => byId.get(id))
        .filter((u): u is AdmMeetingInvitee => !!u)
        .map(inviteeToAttendee);
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
          ...(outcomeAttended
            ? { attendees: [...checked, ...kept].slice(0, 20) }
            : {}),
        },
      );
      return data;
    },
    onSuccess: (data) => {
      void data;
      if (outcomeTarget) markSelfNotified(outcomeTarget.id);
      void queryClient.invalidateQueries({ queryKey: ["coordinator-meetings"] });
      invalidateReferrals();
      // Re-evaluate now so any other due meeting drops its card without
      // waiting for the next tick.
      refreshBookingReminders();
      const wasMissed = !outcomeAttended;
      const missedRow = outcomeRow;
      closeOutcome();
      if (wasMissed && missedRow) {
        // No-show: move straight into booking the home visitation (venue
        // preset to home) instead of leaving the coordinator to hunt for it.
        setBookVenuePreset("home");
        bookForRow(missedRow);
        toast.success({
          title: "Marked as not attended",
          description: "Booking the home visitation now.",
        });
      } else {
        toast.success({
          title: outcomeAttended ? "Attendance recorded" : "Outcome recorded",
          description: outcomeAttended
            ? "Minutes logged — the case can move to certification."
            : "Marked as not attended — the home visitation path applies.",
        });
      }
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

  // `total` = filtered pager count; tiles read the UNFILTERED globals so
  // backend filtering never shrinks them.
  const total = referralsQuery.data?.total ?? 0;
  const totalPages = referralsQuery.data?.totalPages ?? 1;
  // Derived clamp — never setState in an effect (lint forbids it).
  const safePage = Math.min(page, totalPages);
  const limit = referralsQuery.data?.limit ?? COORDINATOR_PAGE_SIZE;
  const start = total === 0 ? 0 : (safePage - 1) * limit + 1;
  const end = Math.min(safePage * limit, total);
  // Default to zeros (not undefined) so the snapshot card renders
  // deterministically on first paint instead of flashing blanks.
  const stageCounts = referralsQuery.data?.stageCounts ?? {};
  const totalReferred =
    referralsQuery.data?.unfilteredTotal ?? referralsQuery.data?.totalReferred ?? 0;

  return {
    now,
    rows,
    total,
    totalPages,
    safePage,
    limit,
    start,
    end,
    stageCounts,
    totalReferred,
    isInitialLoading: referralsQuery.isPending,
    isSyncing: referralsQuery.isFetching && !referralsQuery.isPending,
    referralsError: referralsQuery.isError || !referralsQuery.data,
    referralsRefetching: referralsQuery.isRefetching,
    refetchReferrals: () => {
      void referralsQuery.refetch();
    },
    query: queryInput,
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
    outcomeInviteeIds,
    setOutcomeInviteeIds,
    closeOutcome,
    forwardTarget,
    setForwardTarget,
    advanceTarget,
    setAdvanceTarget,
    createTarget,
    setCreateTarget,
    termId,
    scopeLabel,
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
    bookVenuePreset,
    rescheduleMeeting,
    confirmBook: (fields: {
      meetingDatetime: string;
      venue: "school" | "home";
      logbook: string;
      inviteeIds: string[];
    }) => {
      if (!bookMutation.isPending) bookMutation.mutate(fields);
    },
    outcomePending: outcomeMutation.isPending,
    confirmOutcome: () => {
      if (!outcomeMutation.isPending) outcomeMutation.mutate();
    },
  };
}
