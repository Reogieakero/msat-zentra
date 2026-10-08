"use client";

import type {
  GuidanceAdmInsightsData,
  GuidanceAdmRecommendation,
} from "@/services/guidance/adm.reports";
import { PRIMARY_STEPS } from "./guidance-adm-reports";
import styles from "./guidance-adm.module.css";

function InsightCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.insightCard} aria-label={label}>
      <span className={styles.glowClip} aria-hidden="true">
        <span className={styles.cardGlow} />
      </span>
      {children}
    </section>
  );
}

function Findings({ data }: { data: GuidanceAdmInsightsData }) {
  return (
    <div className={styles.findings} role="status" aria-label="Key findings">
      {data.findings.map((f) => (
        <InsightCard key={f.key} label={f.label}>
          <p className={styles.findingValue}>{f.value}</p>
          <p className={styles.findingLabel}>{f.label}</p>
          <p className={styles.findingHint}>{f.hint}</p>
        </InsightCard>
      ))}
    </div>
  );
}

const CATEGORY_COLORS = PRIMARY_STEPS;

function Categories({ data }: { data: GuidanceAdmInsightsData }) {
  const top = data.categories[0] ?? null;
  return (
    <InsightCard label="Cases by category">
      <h3 className={styles.sectionTitle}>Cases by category</h3>
      <p className={styles.sectionDesc}>
        What the referred anecdotes were filed as.
      </p>
      {data.categories.length === 0 ? (
        <p className={styles.insightEmpty}>No categorized cases yet.</p>
      ) : (
        <ul className={styles.categoryList}>
          {data.categories.map((c, i) => (
            <li key={c.key} className={styles.categoryRow}>
              <span className={styles.categoryHead}>
                <span
                  className={styles.legendDot}
                  style={{
                    backgroundColor:
                      CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                  }}
                  aria-hidden
                />
                {c.label}
              </span>
              <span className={styles.categoryBar} aria-hidden>
                <span
                  className={styles.categoryFill}
                  style={{
                    width: `${c.share}%`,
                    backgroundColor:
                      CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                  }}
                />
              </span>
              <span className={styles.legendCount}>
                {c.count} · {c.share}%
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.interpretation} role="status">
        {top
          ? `${top.label} leads with ${top.count} of ${data.total} case${data.total === 1 ? "" : "s"} (${top.share}%) — start follow-through with the largest group first.`
          : "Category mix will appear here once cases are referred to you."}
      </p>
    </InsightCard>
  );
}

function formatDays(days: number | null): string {
  return days === null ? "—" : `${days.toFixed(1)}d`;
}

function Bottlenecks({ data }: { data: GuidanceAdmInsightsData }) {
  const { longestDays, avgDays, measured } = data.response;
  return (
    <InsightCard label="Waiting bottlenecks">
      <h3 className={styles.sectionTitle}>Waiting bottlenecks</h3>
      <p className={styles.sectionDesc}>
        Longest-waiting cases still needing action, counseling and ADM.
      </p>
      <div className={styles.responseStats} role="status" aria-label="Guidance response times">
        <div className={styles.responseStat}>
          <span className={styles.responseValue}>{formatDays(longestDays)}</span>
          <span className={styles.responseLabel}>Longest response</span>
        </div>
        <div className={styles.responseStat}>
          <span className={styles.responseValue}>{formatDays(avgDays)}</span>
          <span className={styles.responseLabel}>Average response</span>
        </div>
      </div>
      {data.bottlenecks.length === 0 ? (
        <p className={styles.insightEmpty}>Nothing waiting — the queue is clear.</p>
      ) : (
        <ol className={styles.bottleneckList}>
          {data.bottlenecks.map((b) => (
            <li key={b.id}>
              <a
                className={styles.bottleneckRow}
                href={`/guidance/referrals/${b.kind === "ADM" ? "adm" : "counseling"}?highlight=${b.id}`}
              >
                <span className={styles.bottleneckMain}>
                  <span className={styles.bottleneckName}>
                    {b.kind ? (
                      <span className={styles.bottleneckType}>{b.kind}</span>
                    ) : null}
                    {b.student}
                    {b.section ? ` · ${b.section}` : ""}
                  </span>
                  {b.reason ? (
                    <span className={styles.bottleneckReason}>{b.reason}</span>
                  ) : null}
                </span>
                <span className={styles.bottleneckDays}>
                  {b.waitingDays}d waiting
                </span>
              </a>
            </li>
          ))}
        </ol>
      )}
      <p className={styles.interpretation} role="status">
        {measured === 0
          ? "Response times will appear once cases show recorded handling."
          : `Your response measured over ${measured} handled case${measured === 1 ? "" : "s"}. `}
        {data.bottlenecks.length === 0
          ? "No backlog — new referrals will surface here by waiting time."
          : "Decide the longest-waiting cases before newer arrivals to keep the pipeline fair."}
      </p>
    </InsightCard>
  );
}

function RecommendationRow({ rec }: { rec: GuidanceAdmRecommendation }) {
  const body = (
    <>
      <span className={styles.recMain}>
        <span className={styles.recTitle}>{rec.title}</span>
        <span className={styles.recDetail}>{rec.detail}</span>
      </span>
      <span className={styles.recCount}>{rec.count}</span>
    </>
  );
  return (
    <li key={rec.key}>
      {rec.href ? (
        <a className={styles.recRow} href={rec.href}>
          {body}
        </a>
      ) : (
        <span className={styles.recRow}>{body}</span>
      )}
    </li>
  );
}

function Recommendations({ data }: { data: GuidanceAdmInsightsData }) {
  return (
    <InsightCard label="Recommended actions">
      <h3 className={styles.sectionTitle}>Recommended actions</h3>
      <p className={styles.sectionDesc}>
        What to do next, derived from your live caseload.
      </p>
      {data.recommendations.length === 0 ? (
        <p className={styles.insightEmpty}>
          {data.total === 0
            ? "Recommendations will appear here once cases are referred to you."
            : "You're all caught up — nothing needs action."}
        </p>
      ) : (
        <ul className={styles.recList}>
          {data.recommendations.map((rec) => (
            <RecommendationRow key={rec.key} rec={rec} />
          ))}
        </ul>
      )}
    </InsightCard>
  );
}

export function GuidanceAdmInsights({ data }: { data: GuidanceAdmInsightsData }) {
  return (
    <div className={styles.insights}>
      <Findings data={data} />
      <div className={styles.insightsGrid}>
        <Categories data={data} />
        <Bottlenecks data={data} />
      </div>
      <Recommendations data={data} />
    </div>
  );
}
