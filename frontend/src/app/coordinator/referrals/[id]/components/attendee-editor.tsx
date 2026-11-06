"use client";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MEETING_ATTENDEE_ROLE_LABELS,
  meetingInviteeLabel,
} from "@/services/coordinator/labels";
import type {
  AdmMeetingInvitee,
  MeetingAttendee,
  MeetingAttendeeRole,
} from "@/services/coordinator/coordinator.types";
import styles from "../case-page.module.css";
export function AttendeeEditor({
  meetingId,
  invitees,
  checkedInvitees,
  onToggleInvitee,
  attendees,
  onUpdateAttendee,
  onRemoveAttendee,
  onAddAttendee,
  pending,
}: {
  meetingId: string;
  invitees: AdmMeetingInvitee[];
  checkedInvitees: string[];
  onToggleInvitee: (id: string) => void;
  attendees: MeetingAttendee[];
  onUpdateAttendee: (index: number, patch: Partial<MeetingAttendee>) => void;
  onRemoveAttendee: (index: number) => void;
  onAddAttendee: () => void;
  pending: boolean;
}) {
  void meetingId;
  return (
    <>
      {invitees.length > 0 ? (
        <>
          <p className={styles.metaLabel} style={{ margin: 0 }}>
            Invited staff who attended
            {checkedInvitees.length > 0
              ? ` · ${checkedInvitees.length} present`
              : ""}
          </p>
          {invitees.map((u) => {
            const checked = checkedInvitees.includes(u.id);
            return (
              <label key={u.id} className={styles.inviteeRow}>
                <input
                  type="checkbox"
                  className={styles.nativeCheck}
                  checked={checked}
                  onChange={() => onToggleInvitee(u.id)}
                  aria-label={`Mark ${u.fullName} attended`}
                />
                <span
                  className={styles.customCheck}
                  data-checked={checked ? "true" : "false"}
                  aria-hidden="true"
                >
                  {checked ? <Check size={12} strokeWidth={3} /> : null}
                </span>
                <span
                  className={styles.inviteeName}
                  title={meetingInviteeLabel(u)}
                >
                  {meetingInviteeLabel(u)}
                </span>
              </label>
            );
          })}
        </>
      ) : null}
      <p className={styles.metaLabel} style={{ margin: 0 }}>
        Attendees
      </p>
      {attendees.map((a, i) => (
        <div key={i} className={styles.attendeeRow}>
          <Input
            value={a.name}
            onChange={(e) => onUpdateAttendee(i, { name: e.target.value })}
            placeholder="Full name"
            aria-label={`Attendee ${i + 1} name`}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                aria-label={`Attendee ${i + 1} role`}
                className={styles.attendeeRoleBtn}
              >
                {MEETING_ATTENDEE_ROLE_LABELS[a.role]}
                <ChevronDown aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {(
                Object.entries(MEETING_ATTENDEE_ROLE_LABELS) as [
                  MeetingAttendeeRole,
                  string,
                ][]
              ).map(([value, label]) => (
                <DropdownMenuCheckboxItem
                  key={value}
                  checked={a.role === value}
                  onCheckedChange={() => onUpdateAttendee(i, { role: value })}
                >
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove attendee ${i + 1}`}
            onClick={() => onRemoveAttendee(i)}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ))}
      <div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Add attendee"
          disabled={pending || attendees.length >= 20}
          onClick={onAddAttendee}
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>
    </>
  );
}
