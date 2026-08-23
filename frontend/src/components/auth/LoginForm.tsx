"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ChevronLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { setAccessToken } from "@/lib/api/client";
import styles from "./LoginForm.module.css";

export interface LoginFormProps {
  role: "student" | "staff" | "parent";
  title: string;
  description: string;
  emailLabel?: string;
  emailPlaceholder?: string;
  identifierLabel?: string;
  identifierPlaceholder?: string;
  backHref?: string;
}

export function LoginForm({
  role,
  title,
  description,
  emailLabel = "Email",
  emailPlaceholder = "you@msat.edu",
  identifierLabel,
  identifierPlaceholder,
  backHref = "/login",
}: LoginFormProps) {
  const router = useRouter();
  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, password, role }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message ?? "Sign in failed. Check your credentials.");
      }
      if (data.accessToken) setAccessToken(data.accessToken);
      router.push(`/${role}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
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

      {identifierLabel ? (
        <div className={styles.field}>
          <Label htmlFor="identifier">{identifierLabel}</Label>
          <Input
            id="identifier"
            name="identifier"
            autoComplete="username"
            placeholder={identifierPlaceholder}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </div>
      ) : (
        <div className={styles.field}>
          <Label htmlFor="email">{emailLabel}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder={emailPlaceholder}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </div>
      )}

      <div className={styles.field}>
        <div className={styles.passwordRow}>
          <Label htmlFor="password">Password</Label>
          <Link href={`${backHref}/reset`} className={styles.forgot}>
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
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
            Signing in
          </>
        ) : (
          "Sign in"
        )}
      </Button>

      <Link href={backHref} className={styles.backLink}>
        <ChevronLeft size={14} />
        Choose a different account type
      </Link>
    </form>
  );
}
