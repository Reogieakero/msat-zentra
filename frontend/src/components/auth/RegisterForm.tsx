"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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
import { toast } from "@/components/ui/sonner";
import { PH_MOBILE_MESSAGE, isValidPhMobile, sanitizePhoneInput } from "@/lib/phone";
import { NAME_SUFFIX_OPTIONS } from "@/lib/nameSuffix";
import { GoogleButton } from "./GoogleButton";
import styles from "./RegisterForm.module.css";

type Props = {
  role: "student" | "parent" | "teacher";
  title: string;
  description: string;
};

/** Self-register roles map to their `User.role`; the form's `teacher` label
 *  creates a subject-teacher account (an adviser seat is assigned later). */
const API_ROLE: Record<Props["role"], string> = {
  student: "student",
  parent: "parent",
  teacher: "subject_teacher",
};

export function RegisterForm({ role, title, description }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = React.useState("");
  const [suffix, setSuffix] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [lrn, setLrn] = React.useState("");
  const [contactNumber, setContactNumber] = React.useState("");
  const [employeeId, setEmployeeId] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const apiRole = API_ROLE[role];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!isValidPhMobile(contactNumber)) {
      setError(PH_MOBILE_MESSAGE);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/register/${apiRole}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            fullName,
            suffix: role === "teacher" ? suffix || undefined : undefined,
            role: apiRole,
            lrn: role === "student" ? lrn : undefined,
            contactNumber: contactNumber || undefined,
            employeeId: role === "teacher" ? employeeId || undefined : undefined,
            department: role === "teacher" ? department || undefined : undefined,
          }),
        },
      );
      let data: { message?: string } = {};
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) data = await res.json();

      if (!res.ok) {
        const message = data?.message ?? `Sign up failed (${res.status}).`;
        setError(message);
        toast.error({ title: "Sign up failed", description: message });
        return;
      }

      if (role === "teacher") {
        // The admin reviews these details in the pending-teacher queue, so
        // confirm exactly what was submitted.
        setSubmitted(true);
        return;
      }

      toast.success({
        title: "Request submitted",
        description: "Your account is pending registrar approval.",
      });
      router.push("/login");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      toast.error({ title: "Sign up failed", description: message });
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    const displayName = `${fullName.trim()}${suffix.trim() ? ` ${suffix.trim()}` : ""}`;
    const details = [
      { label: "Full name", value: displayName },
      { label: "Email", value: email },
      { label: "Contact number", value: contactNumber || "—" },
      { label: "Employee ID", value: employeeId || "—" },
      { label: "Department", value: department || "—" },
    ];
    return (
      <div className={styles.form}>
        <div className={styles.heading}>
          <h1 className={styles.title}>Request received</h1>
          <p className={styles.subtitle}>
            Your teacher account is waiting for school administrator approval. The details below
            are what the administrator will review.
          </p>
        </div>

        <dl className={styles.details}>
          {details.map((detail) => (
            <div key={detail.label} className={styles.detailRow}>
              <dt className={styles.detailLabel}>{detail.label}</dt>
              <dd className={styles.detailValue}>{detail.value}</dd>
            </div>
          ))}
        </dl>

        <Button asChild size="lg" className={styles.submit}>
          <Link href="/login/staff">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <div className={styles.heading}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{description}</p>
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
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@msat.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      {role === "teacher" ? (
        <>
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
        </>
      ) : null}

      {role === "student" ? (
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
      ) : null}

      <div className={styles.field}>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
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
          "Create account"
        )}
      </Button>

      <div className={styles.divider}>
        <span className={styles.dividerLine} />
        <span className={styles.dividerText}>or</span>
        <span className={styles.dividerLine} />
      </div>

      <GoogleButton
        role={role === "teacher" ? "staff" : role}
        intent="signup"
        disabled={loading}
        onError={(message) => setError(message || null)}
      />

      <div className={styles.signin}>
        Already have an account?{" "}
        <Link href={role === "teacher" ? "/login/staff" : "/login"} className={styles.signinLink}>
          Sign in
        </Link>
      </div>
    </form>
  );
}
