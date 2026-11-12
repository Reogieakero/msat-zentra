"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createAuthClient } from "@/lib/supabase/client";
import styles from "./complete.module.css";

/**
 * Second half of a Google student sign-up: the account exists but is pending
 * until the LRN is supplied (the registrar checks it against the roster).
 */
export default function CompleteGoogleSignupPage() {
  const [lrn, setLrn] = React.useState("");
  const [contactNumber, setContactNumber] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createAuthClient();
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        throw new Error("Your Google sign-up expired. Start again from the sign-up page.");
      }

      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
      const res = await fetch(`${base}/api/auth/google/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          supabaseAccessToken: accessToken,
          lrn,
          contactNumber: contactNumber || undefined,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
        message?: string;
      };

      if (!res.ok) {
        throw new Error(
          payload.error?.message ?? payload.message ?? `Sign up failed (${res.status}).`,
        );
      }

      window.sessionStorage.removeItem("zentra.oauth.role");
      window.sessionStorage.removeItem("zentra.oauth.intent");
      void supabase.auth.signOut({ scope: "local" });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <AuthShell role="student">
        <div className={styles.panel}>
          <h1 className={styles.title}>Request submitted</h1>
          <p className={styles.subtitle}>
            Your account is pending registrar approval. You can sign in with Google once it
            has been approved.
          </p>
          <Button asChild size="lg">
            <Link href="/login/students">Back to sign in</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell role="student">
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <div className={styles.heading}>
          <h1 className={styles.title}>One more step</h1>
          <p className={styles.subtitle}>
            Add your LRN so the registrar can match your Google account to your school record.
          </p>
        </div>

        <div className={styles.field}>
          <Label htmlFor="lrn">LRN (Learner Reference Number)</Label>
          <Input
            id="lrn"
            name="lrn"
            autoComplete="off"
            placeholder="12-digit LRN, e.g. 209123456789"
            value={lrn}
            onChange={(e) => setLrn(e.target.value)}
            required
          />
          <p className={styles.hint}>
            Must match an official student record. The registrar verifies this before approval.
          </p>
        </div>

        <div className={styles.field}>
          <Label htmlFor="contactNumber">Contact number (optional)</Label>
          <Input
            id="contactNumber"
            name="contactNumber"
            type="tel"
            autoComplete="tel"
            placeholder="09XXXXXXXXX"
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
          />
        </div>

        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={loading} className={styles.submit}>
          {loading ? (
            <>
              <Loader2 size={16} className={styles.spinner} />
              Submitting
            </>
          ) : (
            "Finish sign up"
          )}
        </Button>

        <div className={styles.signin}>
          Already approved?{" "}
          <Link href="/login/students" className={styles.signinLink}>
            Sign in
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
