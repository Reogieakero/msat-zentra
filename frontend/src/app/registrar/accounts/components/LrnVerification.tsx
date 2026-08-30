import * as React from "react";
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

  const [state, setState] = React.useState<
    { status: "idle" } | { status: "loading" } | { status: "done"; data: LrnMatchResult } | { status: "error"; message: string }
  >(
    hasLrn
      ? { status: "loading" }
      : { status: "error", message: "No LRN was provided at sign-up." },
  );
  const [runId, setRunId] = React.useState(0);

  React.useEffect(() => {
    if (!hasLrn) return;
    let active = true;
    apiClient
      .get<LrnMatchResult>("/api/auth/match-lrn", {
        params: { lrn: trimmed, name },
      })
      .then((res) => {
        if (active) setState({ status: "done", data: res.data });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Could not run LRN verification.";
        setState({ status: "error", message });
      });
    return () => {
      active = false;
    };
  }, [hasLrn, trimmed, name, runId]);

  const recheck = () => {
    if (!hasLrn) return;
    setState({ status: "loading" });
    setRunId((n) => n + 1);
  };

  return (
    <section className={styles.panel}>
      <header className={styles.head}>
        <h3 className={styles.title}>LRN Verification</h3>
        <button type="button" className={styles.refresh} onClick={recheck} disabled={state.status === "loading"}>
          Re-check
        </button>
      </header>

      {state.status === "loading" ? (
        <div className={styles.loading}>
          <Loader2 className={styles.spinner} />
          <span>Comparing against student records…</span>
        </div>
      ) : state.status === "error" ? (
        <p className={styles.error}>{state.message}</p>
      ) : state.status === "done" ? (
        <Result data={state.data} />
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
