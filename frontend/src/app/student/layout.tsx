"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { logout } from "@/lib/api/client";
import { useRoleGuard } from "@/lib/auth/useRoleGuard";

const STUDENT_ROLES = ["student"] as const;

function StudentShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    void logout();
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("zentra."))
      .forEach((key) => window.localStorage.removeItem(key));
    queryClient.clear();
    router.push("/login");
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
          <Link
            href="/student/modules"
            className="inline-flex items-center gap-2 text-sm font-bold tracking-[-0.01em] text-foreground"
          >
            Zentra
            <Pill tone="blue" label="Portal">
              Learner
            </Pill>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-7 px-2.5 text-xs"
              onClick={handleLogout}
            >
              <LogOut size={13} aria-hidden /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">{children}</main>
    </div>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { allowed } = useRoleGuard(STUDENT_ROLES);

  if (!allowed) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-6" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-56 w-full rounded-lg" />
      </div>
    );
  }

  return <StudentShell>{children}</StudentShell>;
}
