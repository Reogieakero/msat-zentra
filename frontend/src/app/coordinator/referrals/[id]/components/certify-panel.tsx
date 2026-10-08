"use client";
import { Button } from "@/components/ui/button";
import type { CoordinatorCaseDetail } from "@/services/coordinator/coordinator.types";
import styles from "../case-page.module.css";
export function CertifyPanel({
  d,
  hasCertification,
  hasAttendedMeeting,
  profileCertifiable,
  createPending,
  preparingProfile,
  onCreateProfile,
  onOpenCert,
}: {
  d: CoordinatorCaseDetail;
  hasCertification: boolean;
  hasAttendedMeeting: boolean;
  profileCertifiable: boolean;
  createPending: boolean;
  preparingProfile: boolean;
  onCreateProfile: (d: CoordinatorCaseDetail) => void;
  onOpenCert: () => void;
}) {
  void hasAttendedMeeting;
  return (
    <div className={styles.card}>
      <span className={styles.glowClip} aria-hidden="true">
        <span className={styles.cardGlow} />
      </span>
      <h2 className={styles.cardTitle}>Recommendation &amp; certification</h2>
      {hasCertification ? (
        <p className={styles.cardText} style={{ marginBottom: 0 }}>
          Certification is verified on this case — see the Evidence chain for
          its details. Endorsing passes it to the Principal for signature.
        </p>
      ) : d.kind === "referral" ? (
        <>
          <p className={styles.muted}>
            This is still an early referral with no learner profile — create
            one first so the certification can be filed against it.
          </p>
          <div
            className={styles.attendBtns}
            style={{ justifyContent: "flex-start" }}
          >
            <Button
              disabled={createPending || preparingProfile}
              aria-busy={createPending || preparingProfile || undefined}
              onClick={() => void onCreateProfile(d)}
            >
              {createPending
                ? "Creating…"
                : preparingProfile
                  ? "Preparing…"
                  : "Create learner profile"}
            </Button>
          </div>
        </>
      ) : !hasAttendedMeeting ? (
        <p className={styles.muted} style={{ marginBottom: 0 }}>
          Log an attended parent meeting on step 3 first — the certification
          fill-up opens once attendance is confirmed.
        </p>
      ) : !profileCertifiable ? (
        <p className={styles.cardText} style={{ marginBottom: 0 }}>
          This case already carries a certification — no further fill-up is
          needed here.
        </p>
      ) : (
        <>
          <p className={styles.muted}>
            Everything is gathered — write the ADM recommendation to certify
            the case.
          </p>
          <div
            className={styles.attendBtns}
            style={{ justifyContent: "flex-start" }}
          >
            <Button onClick={onOpenCert}>Continue to certification</Button>
          </div>
        </>
      )}
    </div>
  );
}
