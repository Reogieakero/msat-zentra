"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RotateCw, LifeBuoy } from "lucide-react";
import { FluidBackground } from "@/components/auth/FluidBackground";
import styles from "./status.module.css";

export type StatusVariant = "401" | "403" | "404" | "500" | "generic";

export interface StatusPageProps {
  code?: StatusVariant;
  title?: string;
  description?: string;
  onRetry?: () => void;
  onBack?: () => void;
  backHref?: string;
}

const PRESETS: Record<
  Exclude<StatusVariant, "generic">,
  { code: string; title: string; description: string; icon: React.ComponentType<{ className?: string }>; showRetry: boolean }
> = {
  "401": {
    code: "401",
    title: "Session expired",
    description:
      "Your sign-in session is no longer valid. Re-authenticate to continue working with learner records.",
    icon: LifeBuoy,
    showRetry: false,
  },
  "403": {
    code: "403",
    title: "Access restricted",
    description:
      "Your role does not have permission to view this section. If you believe this is an error, contact your school administrator.",
    icon: LifeBuoy,
    showRetry: false,
  },
  "404": {
    code: "404",
    title: "Page not found",
    description:
      "The page or record you are looking for has moved or does not exist. Check the address or return to your workspace.",
    icon: LifeBuoy,
    showRetry: false,
  },
  "500": {
    code: "500",
    title: "Something went wrong",
    description:
      "The server encountered an unexpected error while processing your request. Your data is safe — please try again.",
    icon: LifeBuoy,
    showRetry: true,
  },
};

export function StatusPage({
  code = "generic",
  title,
  description,
  onRetry,
  onBack,
  backHref,
}: StatusPageProps) {
  const preset =
    code === "generic"
      ? null
      : PRESETS[code];

  const heading = title ?? preset?.title ?? "Unexpected error";
  const body =
    description ??
    preset?.description ??
    "An unexpected problem occurred. Please try again or return to your workspace.";
  const Icon = preset?.icon ?? LifeBuoy;
  const showRetry = Boolean(onRetry) || (preset?.showRetry ?? false);

  return (
    <main className={styles.wrap} role="alert" aria-live="assertive">
      <FluidBackground />

      <div className={styles.card}>
        <div className={styles.codeBlock} aria-hidden="true">
          <span className={styles.code}>{preset?.code ?? "—"}</span>
        </div>

        <div className={styles.content}>
          <div className={styles.iconRow}>
            <Icon className={styles.icon} />
            <span className={styles.eyebrow}>Zentra</span>
          </div>

          <h1 className={styles.title}>{heading}</h1>
          <p className={styles.description}>{body}</p>

          <div className={styles.actions}>
            <Button
              variant="outline"
              size="lg"
              onClick={onBack ?? (backHref ? () => (window.location.href = backHref) : () => history.back())}
            >
              <ArrowLeft />
              Back
            </Button>

            {showRetry ? (
              <Button
                variant="default"
                size="lg"
                onClick={onRetry ?? (() => location.reload())}
              >
                <RotateCw />
                Try again
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <p className={styles.footnote}>
        Mati School of Arts and Trades · Student Information System
      </p>
    </main>
  );
}
