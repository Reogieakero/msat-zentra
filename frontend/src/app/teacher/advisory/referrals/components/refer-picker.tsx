"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import refStyles from "./referrals.module.css";
export function ReferPicker({
  id,
  label,
  placeholder,
  value,
  title,
  disabled,
  children,
}: {
  id: string;
  label?: string;
  placeholder: string;
  value: string | null;
  title?: string;
  disabled?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={label ?? placeholder}
            title={title ?? value ?? undefined}
            className={cn(
              "flex w-full items-center justify-start font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <span className="min-w-0 truncate">{value ?? placeholder}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className={`max-h-64 overflow-y-auto w-[var(--radix-dropdown-menu-trigger-width)] ${refStyles.noScrollbar}`}
        >
          {children(() => setOpen(false))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
