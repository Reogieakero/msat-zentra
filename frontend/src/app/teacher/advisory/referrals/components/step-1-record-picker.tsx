"use client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderCard } from "@/components/ui/FolderCard";
import styles from "./ReferralComposer.module.css";
import {
  CATEGORY_LABELS,
  CATEGORY_TONES,
  type AnecdotalRecord,
  type StudentFolder,
} from "./referral-composer-data";
import { truncate } from "./referral-composer-data";
interface Props {
  referables: AnecdotalRecord[];
  studentFolders: StudentFolder[];
  filteredFolders: StudentFolder[];
  totalReferable: number;
  activeFolder: StudentFolder | null;
  anecdotalId: string | null;
  admBlockedSet: Set<string>;
  folderQuery: string;
  setFolderQuery: (v: string) => void;
  onStudentClick: (folder: StudentFolder) => void;
  onRecordSelect: (record: AnecdotalRecord) => void;
  onBackToStudents: () => void;
}
export function Step1RecordPicker({
  referables,
  studentFolders,
  filteredFolders,
  totalReferable,
  activeFolder,
  anecdotalId,
  admBlockedSet,
  folderQuery,
  setFolderQuery,
  onStudentClick,
  onRecordSelect,
  onBackToStudents,
}: Props) {
  return (
    <fieldset className={styles.question}>
      <legend className={`${styles.prompt} ${styles.promptRow}`}>
        <span>Which student and anecdotal record is this referral from?</span>
        {activeFolder ? (
          <Button type="button" variant="outline" size="sm" onClick={onBackToStudents}>
            Back to students
          </Button>
        ) : null}
      </legend>
      {referables.length === 0 ? (
        <p className={styles.empty}>
          No anecdotal records yet — file an anecdotal record first.
        </p>
      ) : (
        <>
          {totalReferable === 0 ? (
            <p className={styles.notice}>
              Every record already has a referral — file a new anecdotal to refer again.
              You can still open a student to review their reports.
            </p>
          ) : null}
          {!activeFolder ? (
            <>
              {studentFolders.length > 1 ? (
                <div className={styles.folderSearch}>
                  <input
                    type="search"
                    className={styles.folderSearchInput}
                    placeholder="Search student or LRN…"
                    value={folderQuery}
                    onChange={(e) => setFolderQuery(e.target.value)}
                    aria-label="Search students with anecdotal records"
                  />
                  <span className={styles.folderCount}>
                    {filteredFolders.length} of {studentFolders.length} students ·{" "}
                    {totalReferable} referable
                  </span>
                </div>
              ) : (
                <span className={styles.folderCount}>
                  {studentFolders.length} student{studentFolders.length !== 1 ? "s" : ""} ·{" "}
                  {totalReferable} referable
                </span>
              )}
              {filteredFolders.length === 0 ? (
                <p className={styles.empty}>
                  No students match “{folderQuery.trim()}”.
                </p>
              ) : (
                <div className={styles.folderGrid}>
                  {filteredFolders.map((folder) => {
                    const allReferred = folder.referableCount === 0;
                    return (
                      <button
                        key={folder.key}
                        type="button"
                        className={`${styles.folderPick} ${allReferred ? styles.folderPickDisabled : ""}`}
                        onClick={() => onStudentClick(folder)}
                        aria-label={`Open ${folder.studentName}'s reports (${folder.referableCount} of ${folder.records.length} referable)`}
                      >
                        <FolderCard
                          label={folder.studentName}
                          sublabel={`LRN ${folder.lrn} · ${folder.section}`}
                          files={folder.records.map((r) => ({
                            name: CATEGORY_LABELS[r.category] ?? r.category,
                            tag: `observed ${r.observationDate}`,
                            tone: CATEGORY_TONES[r.category] ?? 1,
                            icon: "doc",
                          }))}
                        />
                        <span className={styles.folderStatus}>
                          {allReferred ? (
                            <Badge variant="secondary">All referred</Badge>
                          ) : (
                            <Badge variant="outline">
                              {folder.referableCount} of {folder.records.length} referable
                            </Badge>
                          )}
                          {admBlockedSet.has(folder.lrn) ? (
                            <Badge variant="default">ADM case open</Badge>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className={styles.recordGrid}>
              <p className={styles.recordHeading}>
                {activeFolder.studentName} · LRN {activeFolder.lrn} — pick which report to
                refer ({activeFolder.referableCount} of {activeFolder.records.length}{" "}
                referable)
              </p>
              {activeFolder.records
                .slice()
                .sort((a, b) => {
                  if (!!a.hasReferral !== !!b.hasReferral) return a.hasReferral ? 1 : -1;
                  return (b.observationDate ?? "").localeCompare(a.observationDate ?? "");
                })
                .map((r) => {
                  const selected = r.id === anecdotalId;
                  const disabled = !!r.hasReferral;
                  const title = r.hasReferral
                    ? "This report already has a referral"
                    : `Refer this ${CATEGORY_LABELS[r.category] ?? r.category} report`;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      aria-pressed={selected}
                      disabled={disabled}
                      aria-disabled={disabled}
                      title={title}
                      className={`${styles.folderPick} ${selected ? styles.folderPickSelected : ""} ${disabled ? styles.folderPickDisabled : ""}`}
                      onClick={() => onRecordSelect(r)}
                    >
                      <FolderCard
                        label={CATEGORY_LABELS[r.category] ?? r.category}
                        sublabel={`observed ${r.observationDate}`}
                        files={[
                          {
                            name: truncate(r.excerpt, 28),
                            tag: `${activeFolder.studentName} · ${activeFolder.lrn}`,
                            tone: CATEGORY_TONES[r.category] ?? 1,
                            icon: "doc",
                          },
                        ]}
                      />
                      <span className={styles.folderStatus}>
                        {disabled ? (
                          <Badge variant="secondary">Already referred</Badge>
                        ) : selected ? (
                          <Badge variant="default">Selected</Badge>
                        ) : (
                          <Badge variant="outline">Ready to refer</Badge>
                        )}
                      </span>
                    </button>
                  );
                })}
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}
