"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import {
  applyPalette,
  useTeacherProfileSettings,
} from "@/services/settings/profile-settings";
import { useTeacherInvalidate } from "../../components/use-teacher-invalidate";

const PRIMARY_PRESETS = [
  "#7c3aed",
  "#2563eb",
  "#0d9488",
  "#16a34a",
  "#d97706",
  "#ea580c",
  "#e11d48",
  "#db2777",
];

const SECONDARY_PRESETS = [
  "#27272a",
  "#3f3f46",
  "#52525b",
  "#a1a1aa",
  "#e4e4e7",
  "#f4f4f5",
  "#fef3c7",
  "#ede9fe",
];

function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function SwatchRow({
  label,
  htmlFor,
  colors,
  value,
  onPick,
}: {
  label: string;
  htmlFor: string;
  colors: string[];
  value: string | null;
  onPick: (hex: string) => void;
}) {
  return (
    <div>
      <p id={htmlFor} className="mb-2 text-sm font-medium">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-labelledby={htmlFor}>
        {colors.map((hex) => {
          const active = value?.toLowerCase() === hex.toLowerCase();
          return (
            <Button
              key={hex}
              type="button"
              role="radio"
              aria-checked={active}
              title={hex}
              aria-label={`${label} ${hex}`}
              onClick={() => onPick(hex)}
              variant="outline"
              size="icon"
              style={{ backgroundColor: hex }}
              className={cn(
                "size-8 shrink-0 rounded-full",
                active && "ring-2 ring-ring ring-offset-2 ring-offset-card",
              )}
            />
          );
        })}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Custom color"
              aria-label={`Custom ${label.toLowerCase()} color`}
              className="size-8 shrink-0 overflow-hidden rounded-full p-0"
            >
              <span
                aria-hidden="true"
                className="size-full"
                style={{
                  background:
                    "conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
                }}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-3">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={value ?? "#7c3aed"}
                onChange={(e) => onPick(e.target.value)}
                aria-label={`Custom ${label.toLowerCase()} color`}
                className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
              />
              <span className="text-sm tabular-nums text-muted-foreground">
                {(value ?? "custom").toUpperCase()}
              </span>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

/* Workspace palette: primary + secondary brand colors. Picks preview live
   across the site; Save persists them to the teacher's StaffProfile row and
   Reset returns to the theme default. */
export function PaletteCard() {
  const invalidateTeacher = useTeacherInvalidate();
  const profile = useTeacherProfileSettings();

  const savedPrimary = profile.data?.primaryColor ?? null;
  const savedSecondary = profile.data?.secondaryColor ?? null;
  const [primary, setPrimary] = React.useState<string | null>(null);
  const [secondary, setSecondary] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Sync picked colors from the saved profile during render, never in an
  // effect — same behavior (server values win on load + after save) with no
  // cascading renders.
  const [prevSaved, setPrevSaved] = React.useState<{
    primary: string | null;
    secondary: string | null;
  } | null>(null);
  if (
    prevSaved === null ||
    prevSaved.primary !== savedPrimary ||
    prevSaved.secondary !== savedSecondary
  ) {
    setPrevSaved({ primary: savedPrimary, secondary: savedSecondary });
    setPrimary(savedPrimary);
    setSecondary(savedSecondary);
  }

  // Live preview across the site as colors are picked.
  React.useEffect(() => {
    if (profile.data) applyPalette(primary, secondary);
  }, [primary, secondary, profile.data]);

  const dirty =
    (primary ?? null) !== savedPrimary || (secondary ?? null) !== savedSecondary;

  async function persist(nextPrimary: string | null, nextSecondary: string | null, verb: string) {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      await apiClient.patch("/api/teacher/settings/profile", {
        primaryColor: nextPrimary,
        secondaryColor: nextSecondary,
      });
      invalidateTeacher.settings();
      toast.success({ title: `Palette ${verb}`, description: "Your workspace colors were saved." });
    } catch (err) {
      const message = getErrorMessage(err, "Could not save your palette.");
      setError(message);
      toast.error({ title: "Could not save palette", description: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="section-palette" aria-labelledby="settings-palette" className={`${assign.card} scroll-mt-24`}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative">
        <h2 id="settings-palette" className="text-base font-semibold">
          Workspace palette
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Primary and secondary brand colors — buttons, badges, avatars, and card
          accents follow them everywhere. Picks preview instantly.
        </p>
      </div>
      <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SwatchRow
          label="Primary"
          htmlFor="palette-primary"
          colors={PRIMARY_PRESETS}
          value={primary}
          onPick={setPrimary}
        />
        <SwatchRow
          label="Secondary"
          htmlFor="palette-secondary"
          colors={SECONDARY_PRESETS}
          value={secondary}
          onPick={setSecondary}
        />
      </div>
      <div
        className="relative rounded-xl border border-input bg-card p-4"
        aria-label="Palette preview"
      >
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Preview
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm">
            Primary button
          </Button>
          <Badge variant="secondary">Secondary badge</Badge>
          <Badge>Primary badge</Badge>
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            A
          </span>
        </div>
      </div>
      {error ? (
        <p role="alert" className="relative text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="relative flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={saving || !dirty}
          aria-busy={saving || undefined}
          onClick={() => void persist(primary, secondary, "saved")}
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden />
              <span aria-live="polite">Saving…</span>
            </>
          ) : (
            "Save palette"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => {
            setPrimary(null);
            setSecondary(null);
            void persist(null, null, "reset");
          }}
        >
          Reset to default
        </Button>
        {dirty && !saving ? (
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
        ) : null}
      </div>
    </section>
  );
}
