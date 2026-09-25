"use client";

import { format } from "date-fns";
import { CalendarDays, Check, ChevronDown, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FolderCard } from "@/components/ui/FolderCard";
import type { BamaConversation } from "./bama-conversations";
import { CATEGORIES, CATEGORY_TONES, TIERS } from "./bama-flow";
import type { AnecdotalFlow } from "./useAnecdotalFlow";
import { TimePickers } from "./TimePickers";
import styles from "./bama-flow-dialogs.module.css";

interface BamaFlowDialogsProps {
  flow: AnecdotalFlow;
  active: BamaConversation | null;
}

export function BamaFlowDialogs({ flow, active }: BamaFlowDialogsProps) {
  const reviewPreview = active?.messages.find((m) => m.preview)?.preview ?? null;

  return (
    <>
      <Dialog open={flow.studentOpen} onOpenChange={flow.setStudentOpen}>
        <DialogContent className={styles.studentDialog}>
          <DialogHeader>
            <DialogTitle>Pick a student</DialogTitle>
            <DialogDescription>
              Who is this anecdotal report for?
            </DialogDescription>
          </DialogHeader>
          <Input
            value={flow.studentQ}
            onChange={(e) => flow.setStudentQ(e.target.value)}
            placeholder="Search name, LRN, or section…"
            aria-label="Search students"
            className={styles.pickerSearch}
          />
          <div className={`${styles.pickerList} ${styles.dialogList}`} role="listbox" aria-label="Students">
            {flow.optionsPending ? (
              <div aria-busy="true" aria-label="Loading students">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={styles.pickerItem} aria-hidden="true">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                ))}
              </div>
            ) : flow.studentRows.length === 0 ? (
              <p className={styles.pickerEmpty}>No students match.</p>
            ) : (
              flow.studentRows.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className={styles.pickerItem}
                  onClick={() => flow.handleStudentPick(s.id)}
                >
                  <span className={styles.pickerName}>{s.name}</span>
                  <span className={styles.pickerMeta}>{s.lrn}</span>
                </button>
              ))
            )}
          </div>
          {flow.studentMatches.length > flow.studentRows.length ? (
            <p className={styles.pickerMore}>
              {flow.studentMatches.length - flow.studentRows.length} more — refine your search.
            </p>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={flow.classOpen} onOpenChange={flow.setClassOpen}>
        <DialogContent className={styles.studentDialog}>
          <DialogHeader>
            <DialogTitle>Pick a class</DialogTitle>
            <DialogDescription>
              Which class is this report for?
            </DialogDescription>
          </DialogHeader>
          <div className={styles.dialogOptions} role="listbox" aria-label="Classes">
            {flow.classes.map((c) => {
              const value = `${c.subjectId}|${c.sectionId}|${c.termId}`;
              return (
                <Button
                  key={value}
                  type="button"
                  variant="outline"
                  className={styles.dialogOption}
                  onClick={() => flow.handleClassPick(value)}
                >
                  {c.subjectName}
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={flow.categoryOpen} onOpenChange={flow.setCategoryOpen}>
        <DialogContent className={styles.studentDialog}>
          <DialogHeader>
            <DialogTitle>Pick a category</DialogTitle>
            <DialogDescription>
              What is the category for this report?
            </DialogDescription>
          </DialogHeader>
          <div className={styles.dialogOptions} role="listbox" aria-label="Categories">
            {CATEGORIES.map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant="outline"
                className={styles.dialogOption}
                onClick={() => flow.handleCategoryPick(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={flow.tierOpen} onOpenChange={flow.setTierOpen}>
        <DialogContent className={styles.studentDialog}>
          <DialogHeader>
            <DialogTitle>Pick a confidentiality tier</DialogTitle>
            <DialogDescription>
              What is the confidentiality tier?
            </DialogDescription>
          </DialogHeader>
          <div className={styles.dialogOptions} role="listbox" aria-label="Confidentiality tiers">
            {TIERS.map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant="outline"
                className={styles.dialogOption}
                onClick={() => flow.handleTierPick(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={flow.datetimeOpen} onOpenChange={flow.setDatetimeOpen}>
        <DialogContent className={styles.studentDialog}>
          <DialogHeader>
            <DialogTitle>Pick the incident date</DialogTitle>
            <DialogDescription>
              When did this happen?
            </DialogDescription>
          </DialogHeader>
          <div className={styles.datetimeRow}>
            <div className={styles.datetimeField}>
              <span className={styles.datetimeLabel}>
                <CalendarDays aria-hidden /> Date
              </span>
              <Popover open={flow.datePopoverOpen} onOpenChange={flow.setDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={styles.dateBtn}
                    aria-haspopup="dialog"
                    aria-expanded={flow.datePopoverOpen}
                  >
                    <span className={styles.dateBtnValue}>{flow.dateInput || "Pick a date"}</span>
                    <ChevronDown className={styles.dateBtnChevron} aria-hidden />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start">
                  <Calendar
                    mode="single"
                    selected={flow.dateInput ? new Date(`${flow.dateInput}T00:00:00`) : undefined}
                    defaultMonth={flow.dateInput ? new Date(`${flow.dateInput}T00:00:00`) : new Date()}
                    disabled={{ after: new Date() }}
                    onSelect={(day) => {
                      if (day) {
                        flow.setDateInput(format(day, "yyyy-MM-dd"));
                        flow.setDatePopoverOpen(false);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className={styles.datetimeField}>
              <span className={styles.datetimeLabel}>
                <Clock aria-hidden /> Time
              </span>
              <TimePickers
                value={flow.timeInput}
                onPick={(h, m, ap) => flow.setTimeParts(h, m, ap)}
              />
            </div>
          </div>
          <Button
            type="button"
            disabled={!flow.dateInput}
            onClick={flow.handleDatetimeConfirm}
          >
            <Check aria-hidden />
            Confirm date
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog
        open={flow.confirmFiling}
        onOpenChange={flow.setConfirmFiling}
      >
        <DialogContent className={styles.confirmDialog}>
          <DialogHeader>
            <DialogTitle>File this record?</DialogTitle>
            <DialogDescription>
              This creates the anecdotal record and autofills GCForm-01. This is how it will be filed:
            </DialogDescription>
          </DialogHeader>
          {reviewPreview ? (
            <div className={styles.confirmFolder}>
              <FolderCard
                label={reviewPreview.studentName}
                sublabel={`${reviewPreview.category} · ${reviewPreview.observationDateTime}`}
                files={[
                  {
                    name: "GCForm-01",
                    tag: reviewPreview.category,
                    tone: CATEGORY_TONES[reviewPreview.category.toLowerCase()] ?? 1,
                    icon: "doc",
                  },
                ]}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => flow.setConfirmFiling(false)}>
              Keep editing
            </Button>
            <Button
              type="button"
              onClick={() => {
                flow.setConfirmFiling(false);
                void flow.fileRecord();
              }}
            >
              File record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {flow.filing ? (
        <div className={styles.filingOverlay} role="alertdialog" aria-modal="true" aria-label="Filing record">
          <div className={styles.filingCard}>
            <p className={styles.filingTitle}>Filing your record…</p>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${flow.fileProgress}%` }} />
            </div>
            <p className={styles.progressLabel}>
              {flow.fileStage} {flow.fileProgress}%
            </p>
            <p className={styles.filingHint}>Please wait — don&apos;t close this page.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
