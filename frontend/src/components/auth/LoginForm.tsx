"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { setAccessToken } from "@/lib/api/client";
import { isTeacherRole } from "@/lib/auth/roles";
import { homeForRole } from "@/lib/auth/home";
import { GoogleButton } from "./GoogleButton";
import { useTerm } from "@/lib/term/TermContext";
import { toast } from "@/components/ui/sonner";
import styles from "./LoginForm.module.css";

export interface LoginFormProps {
  role: "student" | "staff" | "parent" | "admin";
  title: string;
  description: string;
  emailLabel?: string;
  emailPlaceholder?: string;
  identifierLabel?: string;
  identifierPlaceholder?: string;
  backHref?: string;
  signupHref?: string;
  signupLabel?: string;
  showSignup?: boolean;
  showGoogle?: boolean;
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
  signupHref = "/register",
  signupLabel = "Sign up here",
  showSignup = true,
  showGoogle = true,
}: LoginFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setPromptRequired } = useTerm();
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

          credentials: "include",
          body: JSON.stringify({ email: identifier, password, role }),
        },
      );
      let data: { message?: string; role?: string; accessToken?: string } = {};
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      }
      if (!res.ok) {
        const message =
          data?.message ??
          (res.status === 0
            ? "Cannot reach the server. Check your connection."
            : `Sign in failed (${res.status}). Check your credentials.`);
        setError(message);
        toast.error({ title: "Sign in failed", description: message });
        return;
      }
      if (data.accessToken) setAccessToken(data.accessToken);

      queryClient.clear();

      // Only teacher roles pick a term; every other role is scoped server-side,
      // so never prompt them (and clear any leftover prompt flag).
      setPromptRequired(isTeacherRole(data.role));
      toast.success({ title: "Signed in", description: "Redirecting you now." });
      router.push(homeForRole(data.role ?? ""));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      toast.error({ title: "Sign in failed", description: message });
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

      {showGoogle && role !== "admin" ? (
        <>
          <div className={styles.divider}>
            <span className={styles.dividerLine} />
            <span className={styles.dividerText}>or</span>
            <span className={styles.dividerLine} />
          </div>

          <GoogleButton role={role} intent="login" disabled={loading} onError={setError} />
        </>
      ) : null}

      {showSignup ? (
        <div className={styles.signup}>
          No account yet?{" "}
          <Link href={signupHref} className={styles.signupLink}>
            {signupLabel}
          </Link>
        </div>
      ) : null}
    </form>
  );
}
