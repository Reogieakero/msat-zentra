"use client";

import dynamic from "next/dynamic";
import { roleLabel } from "@/lib/auth/roles";
import { useAdminLoginActivity, useAdminPresence } from "@/services/admin/admin.service";
import GlobeSkeleton from "./components/globe-skeleton";
import LoginActivityChart from "./components/login-activity-chart";
import LoginActivityChartSkeleton from "./components/login-activity-chart-skeleton";
import { LEGEND_ROLES, roleColor } from "./components/role-colors";
import styles from "./overview.module.css";

// `three` needs `window`; the globe is client-only around a canvas.
const PresenceGlobe = dynamic(() => import("./components/presence-globe"), {
  ssr: false,
  loading: () => <GlobeSkeleton />,
});

export default function AdminOverviewPage() {
  const { data, isPending, isError, refetch } = useAdminPresence();
  const { data: activity } = useAdminLoginActivity(24);
  const active = data?.active ?? [];

  return (
    <section className={styles.stage} aria-busy={isPending || undefined}>
      {/* Mount immediately so the three.js chunk downloads while presence
          loads, instead of waiting for the API before starting. */}
      <PresenceGlobe users={active} />

      {/* Login-activity line chart, top-left. */}
      <aside className={styles.activity} aria-label="Login activity">
        {activity ? (
          <LoginActivityChart
            events={activity.events}
            total={activity.total}
            signOuts={activity.signOuts}
            windowHours={activity.windowHours}
          />
        ) : (
          <LoginActivityChartSkeleton />
        )}
      </aside>

      {/* Role legend — one dot per role, matching the globe markers. */}
      <aside className={styles.legend} aria-label="Role colour legend">
        <p className={styles.legendTitle}>Role legend</p>
        <ul className={styles.legendList}>
          {LEGEND_ROLES.map((role) => (
            <li key={role} className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{ backgroundColor: roleColor(role) }}
                aria-hidden="true"
              />
              <span>{roleLabel(role)}</span>
            </li>
          ))}
        </ul>
      </aside>

      {isPending ? <GlobeSkeleton /> : null}

      <div className={styles.chip}>
        <span className={styles.liveDot} aria-hidden="true" />
        <strong className={styles.chipCount}>{active.length}</strong>
        <span>active now</span>
      </div>

      {data?.approximate ? (
        <p className={styles.note}>
          Some markers are approximate — those sessions came from a private network.
        </p>
      ) : null}

      {isError ? (
        <div className={styles.error} role="alert">
          <span>Could not load live presence.</span>
          <button type="button" onClick={() => void refetch()} className={styles.retry}>
            Try again
          </button>
        </div>
      ) : null}
    </section>
  );
}
