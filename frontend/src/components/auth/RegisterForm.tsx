"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import styles from "./RegisterForm.module.css";

type Props = {
  role: "student" | "parent";
  title: string;
  description: string;
};

export function RegisterForm({ role, title, description }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [lrn, setLrn] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/register/${role === "student" ? "student" : "parent"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            fullName,
            role,
            lrn: role === "student" ? lrn : undefined,
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

      <div className={styles.signin}>
        Already have an account?{" "}
        <Link href="/login" className={styles.signinLink}>
          Sign in
        </Link>
      </div>
    </form>
  );
}
