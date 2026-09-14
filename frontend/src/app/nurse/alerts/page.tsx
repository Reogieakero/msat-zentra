"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { NurseAlertsSummary } from "./components/NurseAlertsSummary";
import { NurseAlertsFeed } from "./components/NurseAlertsFeed";
import { NurseNotifications } from "./components/NurseNotifications";
import { fetchNurseAlerts } from "./components/nurse-alerts-data";
import styles from "./components/nurse-alerts.module.css";

export default function NurseAlertsPage() {
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery({
    queryKey: ["nurse-alerts"],
    queryFn: fetchNurseAlerts,
    staleTime: 60_000,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["nurse-alerts"] });
    void queryClient.invalidateQueries({ queryKey: ["nurse-overview"] });
  }

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true">
        <div className={styles.skelHead}>
          <Skeleton className={styles.skelEyebrow} />
          <Skeleton className={styles.skelTitle} />
          <Skeleton className={styles.skelLede} />
        </div>

        <div className={styles.kpiGrid}>
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} size="sm" className={styles.card}>
              <CardContent className={styles.skelKpiBody}>
                <Skeleton className={styles.skelKpiLabel} />
                <Skeleton className={styles.skelKpiValue} />
              </CardContent>
            </Card>
          ))}
        </div>

        <hr className={styles.divider} />

        <Card className={`${styles.panel} ${styles.skelPanel}`}>
          <div className={styles.skelPanelHead}>
            <div>
              <Skeleton className={styles.skelCardTitle} />
              <Skeleton className={styles.skelPanelDesc} />
            </div>
            <div className={styles.skelPanelActions}>
              <Skeleton className={styles.skelSearch} />
              <Skeleton className={styles.skelDrop} />
            </div>
          </div>
          <div className={styles.skelGrid}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={styles.skelAlertCard}>
                <div className={styles.skelCardHead}>
                  <div className={styles.skelCardHeadText}>
                    <Skeleton className={styles.skelName} />
                    <Skeleton className={styles.skelNameSub} />
                  </div>
                  <Skeleton className={styles.skelLevel} />
                </div>
                <div className={styles.skelChips}>
                  <Skeleton className={styles.skelChip} />
                  <Skeleton className={styles.skelChip} />
                </div>
                <div className={styles.skelBullets}>
                  {[0, 1, 2].map((j) => (
                    <Skeleton key={j} className={styles.skelBulletLine} />
                  ))}
                </div>
                <div className={styles.skelCardActions}>
                  <Skeleton className={styles.skelBtn} />
                </div>
              </div>
            ))}
          </div>
          <div className={styles.skelPager}>
            <Skeleton className={styles.skelRange} />
            <div className={styles.skelPagerBtns}>
              <Skeleton className={styles.skelBtn} />
              <Skeleton className={styles.skelBtn} />
            </div>
          </div>
        </Card>

        <Card className={`${styles.panel} ${styles.skelPanel}`}>
          <Skeleton className={styles.skelCardTitle} />
          {[0, 1].map((i) => (
            <Skeleton key={i} className={styles.skelRow} />
          ))}
        </Card>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <p className={styles.error}>Could not load alerts.</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div>
        <p className={styles.eyebrow}>School Nurse · Alerts</p>
        <h1 className={styles.title}>Health alerts</h1>
        <p className={styles.lede}>
          {data.summary.total === 0
            ? "Nothing needs your attention right now."
            : `${data.summary.total} alert${data.summary.total === 1 ? "" : "s"} need${
                data.summary.total === 1 ? "s" : ""
              } your attention.`}
        </p>
      </div>

      <NurseAlertsSummary summary={data.summary} />

      <hr className={styles.divider} />

      <NurseAlertsFeed alerts={data.alerts} onChanged={refresh} />

      <hr className={styles.divider} />

      <NurseNotifications
        notifications={data.notifications}
        unread={data.unread}
        onChanged={refresh}
      />
    </section>
  );
}
