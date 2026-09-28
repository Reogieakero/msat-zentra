"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAccessToken } from "@/lib/api/client";
import {
  resolveDefaultTerm,
  useTerm,
  type ActiveTerm,
} from "@/lib/term/TermContext";

function formatRange(start: string | null, end: string | null): string {
  if (!start || !end) return "Dates not set";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

function termStatus(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const now = Date.now();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (s <= now && now <= e) return "Ongoing";
  if (now < s) return "Upcoming";
  return "Ended";
}

const HIDDEN_PREFIXES = ["/login", "/register", "/errors"];

export function TermSelectOverlay() {
  const pathname = usePathname();
  const {
    schoolYears,
    isLoading,
    isError,
    activeTerm,
    setActiveTerm,
    promptRequired,
    setPromptRequired,
  } = useTerm();

  const [authed, setAuthed] = React.useState(false);
  const [yearId, setYearId] = React.useState<string>("");
  const [picked, setPicked] = React.useState<ActiveTerm | null>(null);

  React.useEffect(() => {
    setAuthed(getAccessToken() != null);
  }, [pathname, promptRequired]);

  const mustShow =
    authed &&
    !HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p)) &&
    (promptRequired || (!isLoading && !activeTerm && schoolYears.length > 0));

  // Preselect stored term (if still valid) or the sensible default.
  React.useEffect(() => {
    if (!mustShow || schoolYears.length === 0) return;
    const valid =
      activeTerm &&
      schoolYears.some(
        (y) => y.id === activeTerm.schoolYearId && y.terms.some((t) => t.id === activeTerm.termId),
      )
        ? activeTerm
        : resolveDefaultTerm(schoolYears);
    if (valid) {
      setPicked(valid);
      setYearId(valid.schoolYearId);
    } else if (!yearId) {
      setYearId(schoolYears[0].id);
    }
  }, [mustShow, schoolYears, activeTerm, yearId]);

  if (!mustShow) return null;

  const year = schoolYears.find((y) => y.id === yearId) ?? schoolYears[0] ?? null;
  const terms = [...(year?.terms ?? [])].sort((a, b) => a.termNumber - b.termNumber);

  function handleContinue() {
    if (!picked) return;
    setActiveTerm(picked);
    setPromptRequired(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Select active term"
      className="fixed inset-0 z-[100] overflow-y-auto bg-background"
    >
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-center px-4 py-10">
        <h2 className="text-2xl font-semibold tracking-tight">Select term</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose which term your workspace will display. Each term is a separate card.
        </p>

        {isLoading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            Loading school years…
          </div>
        ) : isError || schoolYears.length === 0 ? (
          <p role="alert" className="py-12 text-sm text-destructive">
            No school years found. Ask your registrar to create one first.
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="w-56 space-y-1.5">
              <Label htmlFor="term-year">School year</Label>
              <Select
                value={year?.id ?? ""}
                onValueChange={(id) => {
                  const next = schoolYears.find((y) => y.id === id);
                  setYearId(id);
                  setPicked(null);
                  if (next) {
                    const d = resolveDefaultTerm([next]);
                    if (d) setPicked(d);
                  }
                }}
              >
                <SelectTrigger id="term-year" className="w-56">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.map((y) => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.name}
                      {y.isActive ? " (Active)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Term">
              {terms.map((t) => {
                const selected = picked?.termId === t.id;
                const status = termStatus(t.startDate, t.endDate);
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() =>
                      year &&
                      setPicked({
                        schoolYearId: year.id,
                        schoolYearName: year.name,
                        termId: t.id,
                        termNumber: t.termNumber,
                      })
                    }
                    className={`flex min-h-44 flex-col rounded-xl border bg-card p-5 text-left shadow-sm transition-all ${
                      selected
                        ? "border-primary ring-2 ring-primary/40"
                        : "border-input hover:border-primary/50 hover:shadow"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-base font-semibold">Term {t.termNumber}</span>
                      {status ? (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                            status === "Ongoing"
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {status}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 text-xs font-medium text-muted-foreground">
                      {year?.name}
                    </span>
                    <span className="mt-3 text-sm">{formatRange(t.startDate, t.endDate)}</span>
                    <span
                      className={`mt-auto pt-4 text-xs font-semibold ${
                        selected ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {selected ? "● Selected" : "○ Select this term"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <Button onClick={handleContinue} disabled={!picked} size="lg" className="sm:min-w-64">
            Continue to workspace
          </Button>
        </div>
      </div>
    </div>
  );
}
