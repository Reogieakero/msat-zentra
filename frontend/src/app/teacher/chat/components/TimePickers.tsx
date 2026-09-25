"use client";

import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HOURS_12, MINUTES, splitTime } from "./bama-flow";
import styles from "./time-pickers.module.css";

interface TimePickersProps {
  value: string;
  onPick: (hour: string | null, minute: string | null, ampm: string | null) => void;
}

// Custom hour / minute / AM-PM dropdowns — no native time-input chrome.
export function TimePickers({ value, onPick }: TimePickersProps) {
  const parts = splitTime(value);
  const menus = [
    { key: "hour", label: "hour", display: parts?.hour ?? "HH", items: HOURS_12 },
    { key: "minute", label: "minute", display: parts?.minute ?? "MM", items: MINUTES },
    { key: "ampm", label: "AM or PM", display: parts?.ampm ?? "--", items: ["AM", "PM"] },
  ] as const;
  return (
    <div className={styles.timeRow} role="group" aria-label="Incident time">
      {menus.map((menu) => (
        <DropdownMenu key={menu.key}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={styles.timeSelect}
              aria-label={`Pick ${menu.label}`}
            >
              <span>{menu.display}</span>
              <ChevronDown className={styles.timeChevron} aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className={styles.timeMenu} align="start">
            {menu.items.map((item) => (
              <DropdownMenuItem
                key={item}
                onSelect={() =>
                  onPick(
                    menu.key === "hour" ? item : null,
                    menu.key === "minute" ? item : null,
                    menu.key === "ampm" ? item : null
                  )
                }
              >
                {item}
                {menu.display === item ? <Check className={styles.timeCheck} aria-hidden /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
    </div>
  );
}
