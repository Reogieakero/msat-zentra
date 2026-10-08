import {
  type PanelDef,
  type ReportsPayload,
} from "@/services/principal/reports";
import styles from "./reports-panels.module.css";
import { EmptyState, PanelFrame } from "./reports-panel-frame";
import { Donut, MiniBar, MiniLine, StackedMini } from "./reports-mini-charts";
import { AccountsPanel, AdmStagesCards, ListPanel } from "./reports-stat-panels";
export function ReportPanel({
  panel,
  data,
}: {
  panel: PanelDef;
  data: ReportsPayload;
}) {
  switch (panel.id) {
    case "trends": {
      const first = data.trends[0]?.avgTransmuted;
      const last = data.trends[data.trends.length - 1]?.avgTransmuted;
      const diff = first != null && last != null ? last - first : 0;
      return (
        <PanelFrame
          title={panel.title}
          hint={panel.hint}
          banner={data.trends.length ? "Live data — snapshot regenerating." : undefined}
          message={
            data.trends.length > 1 ? (
              diff > 0 ? (
                <>Average climbing from {first} to {last} across the plotted terms.</>
              ) : diff < 0 ? (
                <>Average slipping from {first} to {last} across the plotted terms.</>
              ) : (
                <>Average holding steady at {last} across the plotted terms.</>
              )
            ) : undefined
          }
        >
          {data.trends.length ? (
            <MiniLine data={data.trends} />
          ) : (
            <EmptyState />
          )}
        </PanelFrame>
      );
    }
    case "honor_roll": {
      const total = data.honorRollByGrade.reduce((s, r) => s + r.candidates, 0);
      const top = [...data.honorRollByGrade].sort((a, b) => b.candidates - a.candidates)[0];
      return (
        <PanelFrame
          title={panel.title}
          hint={panel.hint}
          message={
            top ? (
              <>Highest: {top.grade} with {top.candidates} of {total} candidates.</>
            ) : undefined
          }
        >
          {data.honorRollByGrade.length ? (
            <MiniBar data={data.honorRollByGrade} dataKey="candidates" labelKey="grade" />
          ) : (
            <EmptyState />
          )}
        </PanelFrame>
      );
    }
    case "adm_stages": {
      const total = data.admStages.reduce((a, s) => a + s.count, 0);
      const top = [...data.admStages].sort((a, b) => b.count - a.count)[0];
      return (
        <PanelFrame
          title={panel.title}
          hint={panel.hint}
          action={
            <span className={styles.totalBadge}>
              <span className={styles.totalBadgeValue}>{total}</span>
              <span className={styles.totalBadgeLabel}>Total Active</span>
            </span>
          }
          message={
            top ? (
              <>{total} active cases, most sitting in {top.stage} ({top.count}).</>
            ) : undefined
          }
        >
          {data.admStages.length ? <AdmStagesCards rows={data.admStages} /> : <EmptyState />}
        </PanelFrame>
      );
    }
    case "adm_eligibility": {
      const total = data.admEligibility.reduce((a, r) => a + Number(r.count), 0);
      const eligible = data.admEligibility.find(
        (r) => String(r.status).toLowerCase() === "eligible"
      );
      const eligibleCount = eligible ? Number(eligible.count) : 0;
      return (
        <PanelFrame
          title={panel.title}
          hint={panel.hint}
          message={
            total > 0 ? (
              <>{eligibleCount} of {total} cases eligible ({Math.round((eligibleCount / total) * 100)}%).</>
            ) : undefined
          }
        >
          {data.admEligibility.length ? (
            <ListPanel rows={data.admEligibility} labelKey="status" valueKey="count" />
          ) : (
            <EmptyState />
          )}
        </PanelFrame>
      );
    }
    case "risk_distribution": {
      const total = data.riskDistribution.reduce((a, r) => a + Number(r.count), 0);
      const at = (level: string) =>
        Number(data.riskDistribution.find((r) => r.level === level)?.count ?? 0);
      return (
        <PanelFrame
          title={panel.title}
          hint={panel.hint}
          message={
            total > 0 ? (
              <>{at("High") + at("Moderate")} of {total} students flagged (High {at("High")} · Moderate {at("Moderate")} · Low {at("Low")}).</>
            ) : undefined
          }
        >
          {data.riskDistribution.length ? (
            <Donut data={data.riskDistribution} labelKey="level" valueKey="count" />
          ) : (
            <EmptyState />
          )}
        </PanelFrame>
      );
    }
    case "intervention": {
      const referred = data.interventionSuccess.reduce((s, r) => s + r.referred, 0);
      const resolved = data.interventionSuccess.reduce((s, r) => s + r.resolved, 0);
      return (
        <PanelFrame
          title={panel.title}
          hint={panel.hint}
          message={
            referred > 0 ? (
              <>{resolved} of {referred} referred resolved ({Math.round((resolved / referred) * 100)}% success).</>
            ) : undefined
          }
        >
          {data.interventionSuccess.length ? (
            <StackedMini data={data.interventionSuccess} />
          ) : (
            <EmptyState />
          )}
        </PanelFrame>
      );
    }
    case "attendance_watch": {
      const lowest = [...data.attendanceWatch].sort((a, b) => a.rate - b.rate)[0];
      return (
        <PanelFrame
          title={panel.title}
          hint={panel.hint}
          message={
            lowest ? (
              <>Lowest: {lowest.section} at {lowest.rate}% present — below the 80% mark.</>
            ) : undefined
          }
        >
          {data.attendanceWatch.length ? (
            <MiniBar data={data.attendanceWatch} dataKey="rate" labelKey="section" hideLabels />
          ) : (
            <EmptyState />
          )}
        </PanelFrame>
      );
    }
    case "audit": {
      const top = [...data.auditActivity].sort((a, b) => b.count - a.count)[0];
      return (
        <PanelFrame
          title={panel.title}
          hint={panel.hint}
          message={
            top ? (
              <>Most frequent: {top.action} ({top.count} events).</>
            ) : undefined
          }
        >
          {data.auditActivity.length ? (
            <MiniBar data={data.auditActivity} dataKey="count" labelKey="action" />
          ) : (
            <EmptyState />
          )}
        </PanelFrame>
      );
    }
    case "anecdotal": {
      const top = [...data.anecdotalCategories].sort((a, b) => b.count - a.count)[0];
      return (
        <PanelFrame
          title={panel.title}
          hint={panel.hint}
          message={
            top ? (
              <>Most filed: {top.category} ({top.count} records).</>
            ) : undefined
          }
        >
          {data.anecdotalCategories.length ? (
            <MiniBar data={data.anecdotalCategories} dataKey="count" labelKey="category" />
          ) : (
            <EmptyState />
          )}
        </PanelFrame>
      );
    }
    case "accounts": {
      const total = data.accountApprovals.reduce((s, r) => s + r.pending, 0);
      const top = [...data.accountApprovals].sort((a, b) => b.pending - a.pending)[0];
      return (
        <PanelFrame
          title={panel.title}
          hint={panel.hint}
          message={
            total > 0 ? (
              <>{total} accounts pending{top ? `, most in ${top.band} (${top.pending})` : ""}.</>
            ) : undefined
          }
        >
          {data.accountApprovals.length ? (
            <AccountsPanel rows={data.accountApprovals} />
          ) : (
            <EmptyState />
          )}
        </PanelFrame>
      );
    }
    default:
      return null;
  }
}
