"use client";
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNowTick } from "@/lib/clock";
import { useTerm } from "@/lib/term/TermContext";
import type { AdmEligibility } from "@/services/coordinator/coordinator.types";
import type {
  AdmCaseRow,
  AdmMeeting,
} from "@/services/coordinator/coordinator.types";
import type { HistoryTarget } from "../../components/CaseHistoryDialog";
import { useCoordinatorFilters } from "./use-coordinator-filters";
import { useCoordinatorMeetings } from "./use-coordinator-meetings";
import { useCoordinatorCaseMutations } from "./use-coordinator-case-mutations";
import { useCoordinatorBooking } from "./use-coordinator-booking";
import { useCoordinatorOutcome } from "./use-coordinator-outcome";
export { COORDINATOR_PAGE_SIZE } from "./use-coordinator-filters";
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
  stageCounts: Record<string, number>;
  totalReferred: number;
  isInitialLoading: boolean;
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
  outcomeInviteeIds: string[];
  setOutcomeInviteeIds: (v: string[]) => void;
  closeOutcome: () => void;
  forwardTarget: AdmCaseRow | null;
  setForwardTarget: (r: AdmCaseRow | null) => void;
  advanceTarget: AdmCaseRow | null;
  setAdvanceTarget: (r: AdmCaseRow | null) => void;
  createTarget: AdmCaseRow | null;
  setCreateTarget: (r: AdmCaseRow | null) => void;
  termId: string;
  scopeLabel: string;
}
interface CoordinatorReferralsActions {
  openBook: () => void;
  bookForRow: (row: AdmCaseRow) => void;
  closeBook: () => void;
  openOutcome: (m: AdmMeeting, row?: AdmCaseRow | null) => void;
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
export function useCoordinatorReferrals(): CoordinatorReferralsModel {
  const queryClient = useQueryClient();
  const now = useNowTick();
  const [selected, setSelected] = React.useState<AdmCaseRow | null>(null);
  const [historyTarget, setHistoryTarget] =
    React.useState<HistoryTarget | null>(null);
  const { activeTerm } = useTerm();
  const termId = activeTerm?.termId ?? "";
  const scopeLabel = activeTerm
    ? `${activeTerm.schoolYearName} · Term ${activeTerm.termNumber}`
    : "No active term";
  const invalidateReferrals = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["coordinator-referrals"] });
    void queryClient.invalidateQueries({ queryKey: ["coordinator-notifications"] });
  }, [queryClient]);
  const invalidateAll = React.useCallback(() => {
    invalidateReferrals();
    void queryClient.invalidateQueries({ queryKey: ["coordinator-dashboard"] });
  }, [invalidateReferrals, queryClient]);
  const filters = useCoordinatorFilters();
  const meetingState = useCoordinatorMeetings(selected);
  const caseMutations = useCoordinatorCaseMutations(invalidateAll, {
    onCaseClosed: () => setSelected(null),
  });
  const booking = useCoordinatorBooking({
    selected,
    meetings: meetingState.meetings,
    invalidateReferrals,
  });
  const outcome = useCoordinatorOutcome({
    invalidateReferrals,
    onMissed: (row) => {
      booking.setBookVenuePreset("home");
      booking.bookForRow(row);
    },
  });
  function closeSheet() {
    setSelected(null);
    booking.setBookOpen(false);
    booking.setBookTarget(null);
    outcome.closeOutcome();
  }
  return {
    now,
    rows: filters.rows,
    total: filters.total,
    totalPages: filters.totalPages,
    safePage: filters.safePage,
    limit: filters.limit,
    start: filters.start,
    end: filters.end,
    stageCounts: filters.stageCounts,
    totalReferred: filters.totalReferred,
    isInitialLoading: filters.isInitialLoading,
    isSyncing: filters.isSyncing,
    referralsError: filters.referralsError,
    referralsRefetching: filters.referralsRefetching,
    refetchReferrals: filters.refetchReferrals,
    query: filters.query,
    setQuery: filters.setQuery,
    debounced: filters.debounced,
    elig: filters.elig,
    setElig: filters.setElig,
    page: filters.page,
    setPage: filters.setPage,
    hasActiveFilters: filters.hasActiveFilters,
    eligMenuLabel: filters.eligMenuLabel,
    clearFilters: filters.clearFilters,
    selected,
    setSelected,
    selectedProfileId: meetingState.selectedProfileId,
    meetings: meetingState.meetings,
    meetingsPending: meetingState.meetingsPending,
    meetingsError: meetingState.meetingsError,
    refetchMeetings: meetingState.refetchMeetings,
    historyTarget,
    setHistoryTarget,
    bookOpen: booking.bookOpen,
    setBookOpen: booking.setBookOpen,
    bookTarget: booking.bookTarget,
    setBookTarget: booking.setBookTarget,
    outcomeTarget: outcome.outcomeTarget,
    setOutcomeTarget: outcome.setOutcomeTarget,
    outcomeAttended: outcome.outcomeAttended,
    setOutcomeAttended: outcome.setOutcomeAttended,
    outcomeMinutes: outcome.outcomeMinutes,
    setOutcomeMinutes: outcome.setOutcomeMinutes,
    outcomeLogbook: outcome.outcomeLogbook,
    setOutcomeLogbook: outcome.setOutcomeLogbook,
    outcomeInviteeIds: outcome.outcomeInviteeIds,
    setOutcomeInviteeIds: outcome.setOutcomeInviteeIds,
    closeOutcome: outcome.closeOutcome,
    forwardTarget: caseMutations.forwardTarget,
    setForwardTarget: caseMutations.setForwardTarget,
    advanceTarget: caseMutations.advanceTarget,
    setAdvanceTarget: caseMutations.setAdvanceTarget,
    createTarget: caseMutations.createTarget,
    setCreateTarget: caseMutations.setCreateTarget,
    termId,
    scopeLabel,
    openBook: booking.openBook,
    bookForRow: booking.bookForRow,
    closeBook: booking.closeBook,
    openOutcome: outcome.openOutcome,
    prepareCreate: caseMutations.prepareCreate,
    prepareCreatePending: caseMutations.prepareCreatePending,
    closeSheet,
    advancePending: caseMutations.advancePending,
    forwardPending: caseMutations.forwardPending,
    confirmAdvance: caseMutations.confirmAdvance,
    confirmForward: caseMutations.confirmForward,
    createPending: caseMutations.createPending,
    canCreate: caseMutations.canCreate,
    confirmCreate: caseMutations.confirmCreate,
    bookPending: booking.bookPending,
    bookPendingId: booking.bookPendingId,
    bookError: booking.bookError,
    bookMode: booking.bookMode,
    bookVenuePreset: booking.bookVenuePreset,
    rescheduleMeeting: booking.rescheduleMeeting,
    confirmBook: booking.confirmBook,
    outcomePending: outcome.outcomePending,
    confirmOutcome: outcome.confirmOutcome,
  };
}
