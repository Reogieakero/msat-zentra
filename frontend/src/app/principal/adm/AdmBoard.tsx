"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiClient } from "@/lib/api/client";
import { fetchAdmDashboard, fetchAdmReferrals, type AdmDashboard } from "./api";
import { useMinLoading } from "./useMinLoading";
import {
  PieChart,
  Pie,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from "recharts";
import { Clock, CheckCircle2, Users } from "lucide-react";
import kpiStyles from "../overview/components/kpi.module.css";
import {
  ADM_PIPELINE,
  type AdmCase,
  type AdmPipelineStage,
} from "./adm";
import { FormIcon } from "./components/FormIcon";
import layout from "./components/admLayout.module.css";
import header from "./components/admHeader.module.css";
import kpi from "./components/admKpi.module.css";
import legend from "./components/admLegend.module.css";
import dialog from "./components/admDialog.module.css";
import shared from "../academics/academics.module.css";
import { AdmBrowser } from "./components/AdmBrowser";
import { CaseTable } from "./components/CaseTable";
import { KpiCard } from "./components/KpiCard";

export { AdmBrowser } from "./components/AdmBrowser";
export { CaseTable } from "./components/CaseTable";

const STAGES: AdmPipelineStage[] = ADM_PIPELINE.map((s) => s.stage);

const SYSTEM_CHART_COLORS: Record<AdmPipelineStage, string> = {
  anecdotal: "#a8a29e",
  consultation: "#f59e0b",
  meeting_parents: "#3b82f6",
  home_visitation: "#8b5cf6",
  certification: "#0ea5e9",
  principal_approval: "#ef4444",
  enrollment_monitoring: "#06b6d4",
  completion: "#22c55e",
};

function stageSystemColor(stage: AdmPipelineStage): string {
  return SYSTEM_CHART_COLORS[stage];
}

function useAdmBoard() {
  const [cases, setCases] = React.useState<AdmCase[]>([]);
  const [loading, setLoading] = useMinLoading(600);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<{
    id: string;
    type: "sign" | "return";
  } | null>(null);
  const [dashboard, setDashboard] = React.useState<AdmDashboard | null>(null);

  const load = React.useCallback((signal?: AbortSignal) => {
    // KPIs + stage breakdown come from the dashboard; the case list is sourced
    // from the same /referrals/all endpoint the "All Referrals" page uses, so
    // the board and the full list can never diverge.
    return Promise.all([
      fetchAdmDashboard(signal),
      fetchAdmReferrals(1, 1000, signal),
    ])
      .then(([dash, referrals]) => {
        if (!dash) return; // aborted
        setDashboard(dash);
        const rows = (referrals?.rows ?? []).map<AdmCase>((r) => ({
          id: r.id,
          student: r.student,
          lrn: r.lrn,
          grade: r.grade,
          section: "",
          stage: r.stage,
          eligibilityStatus:
            r.eligibilityStatus === "eligible"
              ? "eligible"
              : r.eligibilityStatus === "ineligible"
              ? "ineligible"
              : "pending",
          meetingAttended: false,
          modulesSubmitted: 0,
          modulesTotal: 0,
          deviceIssued: false,
          preparedBy: r.preparedBy,
          datePrepared: r.datePrepared,
          forms: r.forms.map((f) => ({ id: f.id, formType: f.formType, title: f.title, status: f.status })),
          approvedBy: r.approvedBy,
          approvalDate: r.approvalDate,
        }));
        setCases(rows);
      })
      .catch((err: unknown) => {
        if ((err as { code?: string })?.code === "ERR_CANCELED") return;
        console.error("[/api/adm] fetch failed:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const pendingCount = dashboard?.kpis.pendingSignature ?? 0;
  const signedCount = dashboard?.kpis.signed ?? 0;

  const stageBreakdown = React.useMemo(
    () =>
      STAGES.map((s) => ({
        stage: s,
        short: ADM_PIPELINE.find((p) => p.stage === s)?.label ?? s,
        count: dashboard?.stageBreakdown.find((d) => d.stage === s)?.count ?? 0,
      })),
    [dashboard]
  );

  const latestReferred = React.useMemo(
    () =>
      [...cases]
        .filter((c) =>
          ["meeting_parents", "home_visitation", "certification", "principal_approval"].includes(
            c.stage
          )
        )
        .slice(0, 5),
    [cases]
  );

  const allReferred = React.useMemo(
    () =>
      [...cases].filter((c) =>
        ["meeting_parents", "home_visitation", "certification", "principal_approval"].includes(
          c.stage
        )
      ),
    [cases]
  );

  const handleSign = (id: string) => {
    apiClient
      .post(`/api/adm/${id}/principal-approve`)
      .then(() => load())
      .catch((err: unknown) => console.error("[/api/adm principal-approve] failed:", err))
      .finally(() => setSelectedId(null));
  };

  const handleReturn = (id: string) => {
    apiClient
      .post(`/api/adm/${id}/principal-return`)
      .then(() => load())
      .catch((err: unknown) => console.error("[/api/adm principal-return] failed:", err))
      .finally(() => setSelectedId(null));
  };

  const confirmPending = () => {
    if (!pendingAction) return;
    if (pendingAction.type === "sign") handleSign(pendingAction.id);
    else handleReturn(pendingAction.id);
    setPendingAction(null);
  };

  return {
    cases,
    loading,
    pendingCount,
    signedCount,
    stageBreakdown,
    latestReferred,
    allReferred,
    selectedId,
    setSelectedId,
    handleSign,
    handleReturn,
    pendingAction,
    setPendingAction,
    confirmPending,
  };
}

export function AdmBoard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const board = useAdmBoard();
  const [legendHovered, setLegendHovered] = React.useState(false);

  return (
    <section className={layout.page}>
      <div className={header.headerRow}>
        <div className={header.headerText}>
          <h1 className={header.headerTitle}>{title}</h1>
          <p className={header.headerSub}>{description}</p>
        </div>
      </div>

      <div className={kpi.topRow}>
        <div
          className={`${kpiStyles.kpi} ${kpiStyles.kpiPlain} ${kpi.kpiChartBlob}`}
          onMouseMove={(e) => {
            const card = e.currentTarget;
            const rect = card.getBoundingClientRect();
            card.style.setProperty("--mx", `${e.clientX - rect.left}px`);
            card.style.setProperty("--my", `${e.clientY - rect.top}px`);
          }}
          onMouseEnter={() => setLegendHovered(true)}
          onMouseLeave={() => setLegendHovered(false)}
        >
          <span className={kpi.kpiLabel}>Cases by Stage</span>
          <div className={kpi.kpiChartWrap}>
            {board.loading ? (
              <Skeleton className={kpi.kpiChartSkeleton} />
            ) : (
              <div className={kpi.kpiChartInner}>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Tooltip
                      cursor={{ fill: "color-mix(in oklch, var(--foreground), transparent 94%)" }}
                      contentStyle={{
                        fontSize: "0.75rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border)",
                        background: "var(--popover)",
                        color: "var(--popover-foreground)",
                      }}
                      labelStyle={{
                        color: "var(--popover-foreground)",
                      }}
                      itemStyle={{
                        color: "var(--popover-foreground)",
                      }}
                      formatter={(value, name) => [`${value} case(s)`, name as string]}
                    />
                    <Pie
                      data={board.stageBreakdown}
                      dataKey="count"
                      nameKey="short"
                      innerRadius="62%"
                      outerRadius="100%"
                      paddingAngle={1}
                      stroke="none"
                    >
                      {board.stageBreakdown.map((d) => (
                        <Cell key={d.stage} fill={stageSystemColor(d.stage)} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className={kpi.kpiDonutCenter}>
                  <span className={kpi.kpiDonutTotal}>
                    {board.stageBreakdown.reduce((sum, d) => sum + d.count, 0)}
                  </span>
                  <span className={kpi.kpiDonutUnit}>cases</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <KpiCard
          icon={<Clock className={kpiStyles.kpiIcon} />}
          value={board.loading ? "—" : `${board.pendingCount}`}
          label="Awaiting Signature"
          description="Referrals ready for your final sign-off."
          loading={board.loading}
        />
        <KpiCard
          icon={<CheckCircle2 className={kpiStyles.kpiIcon} />}
          value={board.loading ? "—" : `${board.signedCount}`}
          label="Signed This Term"
          description="Profiles you have final-signed."
          loading={board.loading}
        />
        <KpiCard
          icon={<Users className={kpiStyles.kpiIcon} />}
          value={board.loading ? "—" : `${board.cases.length}`}
          label="Active Profiles"
          description="Open ADM learner cases."
          loading={board.loading}
        />
      </div>

      <div className={layout.splitRow}>
        <AdmBrowser
          tabs={[{ id: "certification", label: "Latest Referred" }]}
          activeTab="certification"
          onTabChange={() => {}}
          action={
            <a
              href="/principal/adm/referrals/all"
              className={header.seeAllBtn}
            >
              See all
            </a>
          }
        >
          <CaseTable
            rows={board.latestReferred}
            loading={board.loading}
            emptyLabel="No referred cases yet."
            onSelect={board.setSelectedId}
            onRequestAction={(id, type) => board.setPendingAction({ id, type })}
          />
        </AdmBrowser>

        <AlertDialog
          open={board.pendingAction !== null}
          onOpenChange={(open) => {
            if (!open) board.setPendingAction(null);
          }}
        >
          <AlertDialogContent size="default" className={dialog.dialogWide}>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {board.pendingAction?.type === "sign"
                  ? "Sign & approve this case?"
                  : "Return this case for revision?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {board.pendingAction?.type === "sign"
                  ? "You are final-signing this ADM profile. This authorizes module release and moves the case to monitoring."
                  : "The case will be sent back to the ADM Coordinator at the eligibility stage."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {(() => {
              const pendingCase =
                board.pendingAction &&
                board.cases.find((c) => c.id === board.pendingAction!.id);
              if (!pendingCase) return null;
              return (
                <div className={dialog.dialogDocs}>
                  <span className={dialog.dialogDocsName}>
                    {pendingCase.student} <span className={shared.mono}>({pendingCase.lrn})</span>
                  </span>
                  <div className={dialog.dialogDocsRow}>
                    {(pendingCase.forms ?? []).map((f, i) => (
                      <FormIcon
                        key={f.id}
                        formType={f.formType}
                        title={f.title}
                        status={f.status}
                        index={i}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className={
                  board.pendingAction?.type === "sign"
                    ? dialog.alertSign
                    : dialog.alertReturn
                }
                onClick={board.confirmPending}
              >
                {board.pendingAction?.type === "sign" ? "Sign & Approve" : "Confirm Return"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        </div>

      <div
        className={`${legend.kpiChartLegend} ${legend.kpiLegendFloat} ${
          legendHovered ? legend.kpiLegendFloatVisible : ""
        }`}
      >
        {board.stageBreakdown.map((d) => (
          <span key={d.stage} className={legend.kpiLegendItem}>
            <span
              className={legend.kpiLegendSwatch}
              style={{ background: stageSystemColor(d.stage) }}
            />
            <span className={legend.kpiLegendLabel}>{d.short}</span>
            <span className={legend.kpiLegendCount}>{d.count}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
