"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import styles from "./form-dropdown.module.css";

export interface FormDropdownOption {
  value: string;
  label: string;
}

interface FormDropdownProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: FormDropdownOption[];
  /** Short lists (urgency, session kind) fit without scrolling. */
  scrollable?: boolean;
}

/**
 * Single-select dropdown built on DropdownMenu (this project does not use
 * the Select UI). Same string contract: value in, value out.
 */
export function FormDropdown({
  id,
  label,
  value,
  onChange,
  placeholder,
  options,
  scrollable = false,
}: FormDropdownProps) {
  const selected = options.find((option) => option.value === value);

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "mt-1 w-full justify-between text-left font-normal",
              !selected && "text-muted-foreground"
            )}
          >
            <span className={styles.triggerText}>
              {selected ? selected.label : placeholder}
            </span>
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className={cn(styles.content, scrollable && styles.scrollable)}
        >
          <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
            {options.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
