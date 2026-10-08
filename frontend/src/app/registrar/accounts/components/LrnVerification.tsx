import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert, ShieldX, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import type { LrnMatchResult } from "./types";
import styles from "./lrn-verification.module.css";

type Props = {
  lrn: string;
  name: string;
};

export function LrnVerification({ lrn, name }: Props) {
  const trimmed = lrn.trim();
  const hasLrn = trimmed !== "" && trimmed !== "—";

  const verificationQuery = useQuery({
    queryKey: ["lrn-verification", trimmed, name],
    queryFn: ({ signal }) =>
      apiClient
        .get<LrnMatchResult>("/api/auth/match-lrn", {
          params: { lrn: trimmed, name },
          signal,
        })
        .then((res) => res.data),
    enabled: hasLrn,
    staleTime: 5 * 60_000,
  });

  const recheck = () => {
    if (!hasLrn) return;
    void verificationQuery.refetch();
  };

  return (
    <section className={styles.panel}>
      <header className={styles.head}>
        <h3 className={styles.title}>LRN Verification</h3>
        <button
          type="button"
          className={styles.refresh}
          onClick={recheck}
          disabled={!hasLrn || verificationQuery.isFetching}
        >
          Re-check
        </button>
      </header>

      {!hasLrn ? (
        <p className={styles.error}>No LRN was provided at sign-up.</p>
      ) : verificationQuery.isPending ? (
        <div className={styles.loading}>
          <Loader2 className={styles.spinner} />
          <span>Comparing against student records…</span>
        </div>
      ) : verificationQuery.isError ? (
        <p className={styles.error}>
          {verificationQuery.isRefetching
            ? "Re-checking…"
            : "Could not run LRN verification."}
        </p>
      ) : verificationQuery.data ? (
        <Result data={verificationQuery.data} />
      ) : null}
    </section>
  );
}

function Result({ data }: { data: LrnMatchResult }) {
  const verdictClass =
    data.verdict === "match"
      ? styles.match
      : data.verdict === "mismatch"
        ? styles.mismatch
        : styles.notFound;
  const Icon = data.verdict === "match" ? ShieldCheck : data.verdict === "mismatch" ? ShieldAlert : ShieldX;
  const verdictLabel =
    data.verdict === "match" ? "Identity confirmed" : data.verdict === "mismatch" ? "Details do not match" : "LRN not in records";

  return (
    <div className={styles.result}>
      <div className={`${styles.verdict} ${verdictClass}`}>
        <Icon className={styles.verdictIcon} />
        <span className={styles.verdictText}>{verdictLabel}</span>
      </div>

      <ul className={styles.compare}>
        <Row
          label="LRN"
          left={data.claimedLrn}
          right={data.found ? data.roster!.lrn : "— not found —"}
          ok={data.lrnMatch}
        />
        <Row
          label="Name"
          left={data.claimedLrn ? "as submitted" : "—"}
          right={data.found ? data.roster!.fullName : "—"}
          ok={data.nameMatch}
          note={data.found ? `${Math.round(data.nameSimilarity * 100)}% similar` : undefined}
        />
        {data.found ? (
          <Row
            label="Grade / Section"
            left="claimed"
            right={`${data.roster!.gradeLevel}${data.roster!.section ? ` · ${data.roster!.section}` : ""}`}
            ok
          />
        ) : null}
      </ul>

      {data.verdict !== "match" ? (
        <p className={styles.hint}>
          Registrar: confirm with the official SF10/enrollment record before approving.
        </p>
      ) : null}
    </div>
  );
}

function Row({
  label,
  left,
  right,
  ok,
  note,
}: {
  label: string;
  left: string;
  right: string;
  ok: boolean;
  note?: string;
}) {
  return (
    <li className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowLeft}>{left}</span>
      <span className={styles.arrow}>→</span>
      <span className={`${styles.rowRight} ${ok ? styles.ok : styles.bad}`}>{right}</span>
      {note ? <span className={styles.note}>{note}</span> : null}
    </li>
  );
}
