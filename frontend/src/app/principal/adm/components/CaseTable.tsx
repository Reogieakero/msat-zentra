import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { isAwaitingSignature, stageLabel, type AdmCase } from "../mockData";
import { FormIcon } from "./FormIcon";
import table from "./admTable.module.css";
import actions from "./admActions.module.css";
import shared from "../../academics/academics.module.css";

export function CaseTable({
  rows,
  loading,
  emptyLabel,
  onSelect,
  onRequestAction,
}: {
  rows: AdmCase[];
  loading: boolean;
  emptyLabel: string;
  onSelect: (id: string) => void;
  onRequestAction: (id: string, type: "sign" | "return") => void;
}) {
  if (loading) {
    return (
      <div className={table.listSkeleton}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className={table.listSkeletonRow} />
        ))}
      </div>
    );
  }
  if (rows.length === 0) return <p className={shared.empty}>{emptyLabel}</p>;
  return (
    <div className={table.caseTableWrap}>
      <table className={table.caseTable}>
        <thead>
          <tr>
            <th>Student</th>
            <th>Case</th>
            <th>Stage</th>
            <th>Attached Forms</th>
            <th>Date</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const awaiting = isAwaitingSignature(c);
            return (
              <tr
                key={c.id}
                className={table.caseRow}
                onClick={() => onSelect(c.id)}
              >
                <td>
                  <div className={table.listMain}>
                    <span className={table.listName}>{c.student}</span>
                    <span className={table.listMeta}>{c.lrn}</span>
                  </div>
                </td>
                <td className={shared.mono}>{c.id}</td>
                <td>
                  <span
                    className={`${table.stageChip} ${
                      table[`stage_${c.stage.replace(/\s+/g, "")}`]
                    }`}
                  >
                    {stageLabel(c.stage)}
                  </span>
                </td>
                <td>
                  <div className={table.docChips}>
                    {c.forms && c.forms.length > 0 ? (
                      c.forms.map((f, i) => (
                        <FormIcon
                          key={f.id}
                          formType={f.formType}
                          title={f.title}
                          status={f.status}
                          index={i}
                        />
                      ))
                    ) : (
                      <span className={table.docNone}>No forms attached</span>
                    )}
                  </div>
                </td>
                <td className={shared.mono}>
                  {awaiting ? "ready to sign" : c.approvalDate ?? c.datePrepared}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  {awaiting ? (
                    <div className={actions.rowActions}>
                      <button
                        type="button"
                        className={actions.rowSign}
                        onClick={() => onRequestAction(c.id, "sign")}
                      >
                        Sign
                      </button>
                      <button
                        type="button"
                        className={actions.rowReturn}
                        onClick={() => onRequestAction(c.id, "return")}
                      >
                        Return
                      </button>
                    </div>
                  ) : (
                    <span className={actions.rowActionEmpty}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
