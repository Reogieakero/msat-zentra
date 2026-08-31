import * as React from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import styles from "./dropdown-select.module.css";

export type DropdownOption = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
};

export function DropdownSelect({ value, onValueChange, options, placeholder, id, ariaLabel }: Props) {
  const selected = options.find((o) => o.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={styles.dropdown} id={id} aria-label={ariaLabel}>
          <span className={styles.value}>{selected ? selected.label : (placeholder ?? "Select…")}</span>
          <ChevronDown className={styles.chevron} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={styles.menu}>
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            className={styles.item}
            onSelect={() => onValueChange(o.value)}
          >
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
