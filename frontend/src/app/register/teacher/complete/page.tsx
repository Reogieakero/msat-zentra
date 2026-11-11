"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAuthClient } from "@/lib/supabase/client";
import { PH_MOBILE_MESSAGE, isValidPhMobile, sanitizePhoneInput } from "@/lib/phone";
import { NAME_SUFFIX_OPTIONS } from "@/lib/nameSuffix";
import styles from "../../complete/complete.module.css";

/**
 * Second half of a Google teacher sign-up. The account is not created until
 * these personal details are submitted; an accounts desk then approves it.
 */
export default function CompleteTeacherGoogleSignupPage() {
  const [fullName, setFullName] = React.useState("");
  const [suffix, setSuffix] = React.useState("");
  const [contactNumber, setContactNumber] = React.useState("");
  const [employeeId, setEmployeeId] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  // Prefill the name Google already gave us; the teacher can correct it.
  React.useEffect(() => {
    let cancelled = false;
    void createAuthClient()
      .auth.getUser()
      .then(({ data }) => {
        const meta = data.user?.user_metadata;
        const name = meta?.full_name ?? meta?.name;
        if (!cancelled && typeof name === "string" && name.trim()) {
          setFullName((prev) => prev || name.trim());
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!isValidPhMobile(contactNumber)) {
      setError(PH_MOBILE_MESSAGE);
      return;
    }
    setLoading(true);
    try {
      const supabase = createAuthClient();
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        throw new Error("Your Google sign-up expired. Start again from the sign-up page.");
      }

      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
      const res = await fetch(`${base}/api/auth/google/complete-staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          supabaseAccessToken: accessToken,
          fullName,
          suffix: suffix || undefined,
          contactNumber: contactNumber || undefined,
          employeeId: employeeId || undefined,
          department: department || undefined,
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
      <AuthShell role="staff">
        <div className={styles.panel}>
          <h1 className={styles.title}>Request submitted</h1>
          <p className={styles.subtitle}>
            Your teacher account is pending administrator approval. You can sign in with Google
            once it has been approved.
          </p>
          <Button asChild size="lg">
            <Link href="/login/staff">Back to staff sign in</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell role="staff">
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <div className={styles.heading}>
          <h1 className={styles.title}>Teacher account details</h1>
          <p className={styles.subtitle}>
            Confirm your personal details. An administrator reviews them before your account is
            activated.
          </p>
        </div>

        <div className={styles.field}>
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            placeholder="Juan Dela Cruz"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>

        <div className={styles.field}>
          <Label htmlFor="suffix">Suffix (optional)</Label>
          <Select value={suffix || "none"} onValueChange={(v) => setSuffix(v === "none" ? "" : v)}>
            <SelectTrigger id="suffix" className="h-8 w-full text-sm">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {NAME_SUFFIX_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={styles.field}>
          <Label htmlFor="contactNumber">Contact number (optional)</Label>
          <Input
            id="contactNumber"
            name="contactNumber"
            type="tel"
            autoComplete="tel"
            inputMode="numeric"
            placeholder="09XXXXXXXXX or +639XXXXXXXXX"
            value={contactNumber}
            onChange={(e) => setContactNumber(sanitizePhoneInput(e.target.value))}
          />
          <p className={styles.hint}>Philippine mobile number (digits only).</p>
        </div>

        <div className={styles.field}>
          <Label htmlFor="employeeId">Employee ID (optional)</Label>
          <Input
            id="employeeId"
            name="employeeId"
            autoComplete="off"
            placeholder="e.g. EMP-001"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          />
          <p className={styles.hint}>
            Helps the administrator match your request to the school&apos;s staff records.
          </p>
        </div>

        <div className={styles.field}>
          <Label htmlFor="department">Department / teaching area (optional)</Label>
          <Input
            id="department"
            name="department"
            autoComplete="off"
            placeholder="e.g. Mathematics"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
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
          <Link href="/login/staff" className={styles.signinLink}>
            Sign in
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
