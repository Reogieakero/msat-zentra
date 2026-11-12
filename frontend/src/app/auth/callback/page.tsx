"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { setAccessToken } from "@/lib/api/client";
import { isTeacherRole } from "@/lib/auth/roles";
import { homeForRole } from "@/lib/auth/home";
import { useTerm } from "@/lib/term/TermContext";
import { createAuthClient } from "@/lib/supabase/client";
import styles from "./callback.module.css";

type PortalRole = "student" | "parent" | "staff";
type Phase = "working" | "pending" | "noAccount" | "error";

interface ExchangeResponse {
  accessToken?: string;
  role?: string;
  status?: "pending" | "needsProfile" | "noAccount";
  portal?: PortalRole;
  error?: { message?: string };
  message?: string;
}

/** Sign-up page for the portal that just reported "no account". */
const SIGNUP_PATH: Record<PortalRole, string> = {
  student: "/register",
  parent: "/register/parent",
  staff: "/register/teacher",
};

const ROLE_NOUN: Record<PortalRole, string> = {
  student: "student",
  parent: "parent",
  staff: "teacher",
};

/**
 * Supabase Auth lands here after the Google consent screen. The Supabase
 * session is only a bridge: we exchange its access token for the app's own JWT
 * and then drop the Supabase session.
 */
export default function GoogleCallbackPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setPromptRequired } = useTerm();
  const started = React.useRef(false);

  const [portalRole, setPortalRole] = React.useState<PortalRole>("student");
  const [phase, setPhase] = React.useState<Phase>("working");
  const [message, setMessage] = React.useState("Completing your Google sign-in…");

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;

    const storedRole = window.sessionStorage.getItem("zentra.oauth.role");
    const role: PortalRole =
      storedRole === "parent" || storedRole === "staff" ? storedRole : "student";
    const intent = window.sessionStorage.getItem("zentra.oauth.intent") === "signup"
      ? "signup"
      : "login";
    setPortalRole(role);

    void (async () => {
      const supabase = createAuthClient();
      try {
        let { data } = await supabase.auth.getSession();
        // The browser client exchanges the PKCE code on first init; give it one
        // more tick before giving up on a slow round-trip.
        if (!data.session) {
          await new Promise((resolve) => setTimeout(resolve, 700));
          data = (await supabase.auth.getSession()).data;
        }
        const accessToken = data.session?.access_token;
        if (!accessToken) {
          throw new Error("Google sign-in could not be completed. Please try again.");
        }

        const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
        const res = await fetch(`${base}/api/auth/google/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ supabaseAccessToken: accessToken, role, intent }),
        });
        const payload = (await res.json().catch(() => ({}))) as ExchangeResponse;

        if (!res.ok) {
          throw new Error(
            payload.error?.message ?? payload.message ?? `Sign-in failed (${res.status}).`,
          );
        }

        if (payload.accessToken) {
          setAccessToken(payload.accessToken);
          queryClient.clear();
          setPromptRequired(isTeacherRole(payload.role));
          // The app JWT is the session from here on; never keep the Supabase one.
          void supabase.auth.signOut({ scope: "local" });
          router.replace(homeForRole(payload.role ?? ""));
          return;
        }

        if (payload.status === "needsProfile") {
          // Keep the Supabase session: the completion page re-sends its token
          // to finish the sign-up, then clears it itself.
          router.replace(
            payload.role === "subject_teacher" || payload.role === "adviser"
              ? "/register/teacher/complete"
              : "/register/complete",
          );
          return;
        }

        if (payload.status === "noAccount") {
          window.sessionStorage.removeItem("zentra.oauth.role");
          window.sessionStorage.removeItem("zentra.oauth.intent");
          void supabase.auth.signOut({ scope: "local" });
          setMessage("This Google account is not signed up in Zentra yet.");
          setPhase("noAccount");
          return;
        }

        window.sessionStorage.removeItem("zentra.oauth.role");
        window.sessionStorage.removeItem("zentra.oauth.intent");
        void supabase.auth.signOut({ scope: "local" });
        setMessage("Your account is waiting for school approval.");
        setPhase("pending");
      } catch (err) {
        void supabase.auth.signOut({ scope: "local" });
        setMessage(err instanceof Error ? err.message : "Something went wrong.");
        setPhase("error");
      }
    })();
  }, [queryClient, router, setPromptRequired]);

  return (
    <AuthShell role={portalRole}>
      <div className={styles.panel}>
        {phase === "working" ? (
          <>
            <h1 className={styles.title}>Signing you in</h1>
            <p className={styles.subtitle}>
              <Loader2 size={16} className={styles.spinner} />
              {message}
            </p>
          </>
        ) : null}

        {phase === "pending" ? (
          <>
            <h1 className={styles.title}>Request received</h1>
            <p className={styles.subtitle}>
              {message} You can sign in once the{" "}
              {portalRole === "staff" ? "school administrator" : "registrar"} has approved your
              account.
            </p>
            <Button asChild size="lg">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </>
        ) : null}

        {phase === "noAccount" ? (
          <>
            <h1 className={styles.title}>No account found</h1>
            <p className={styles.subtitle}>
              {message} Sign up for a {ROLE_NOUN[portalRole]} account to request access — an
              administrator reviews every request before you can sign in.
            </p>
            <Button asChild size="lg">
              <Link href={SIGNUP_PATH[portalRole]}>
                Sign up for a {ROLE_NOUN[portalRole]} account
              </Link>
            </Button>
            {portalRole === "staff" ? (
              <p className={styles.subtitle}>
                Teacher accounts can self-register. Nurse, guidance, coordinator, registrar,
                record keeper, and principal accounts are created by the school.
              </p>
            ) : null}
            <p className={styles.subtitle}>
              <Link href="/login">Back to sign in</Link>
            </p>
          </>
        ) : null}

        {phase === "error" ? (
          <>
            <h1 className={styles.title}>Sign-in failed</h1>
            <p className={styles.error} role="alert">
              {message}
            </p>
            <Button asChild size="lg">
              <Link href="/login">Try again</Link>
            </Button>
          </>
        ) : null}
      </div>
    </AuthShell>
  );
}
