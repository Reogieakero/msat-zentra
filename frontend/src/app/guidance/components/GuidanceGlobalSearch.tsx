"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Pill } from "@/components/ui/pill";
import { NAV } from "@/components/guidance-sidebar";
import styles from "../guidance.module.css";

/**
 * Guidance global search: a topbar trigger that opens the command palette and
 * jumps to any page in the desk's sidebar (grouped by workspace, same as the
 * sidebar). Ctrl/⌘K opens it from anywhere on the desk.
 */
export function GuidanceGlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [shortcut, setShortcut] = React.useState("Ctrl K");

  React.useEffect(() => {
    // Browser-only: navigator is unavailable during SSR, so the kbd hint is
    // resolved after mount instead of at first render.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only platform sniff
    setShortcut(/mac|iphone|ipad/i.test(navigator.platform) ? "⌘K" : "Ctrl K");
  }, []);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "k" ||
        !(event.metaKey || event.ctrlKey) ||
        event.repeat
      ) {
        return;
      }
      // Don't hijack the shortcut while the user is typing in a form field.
      const target = event.target as HTMLElement | null;
      const editing =
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT";
      if (editing) return;
      event.preventDefault();
      setOpen((prev) => !prev);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        className={styles.searchTrigger}
        onClick={() => setOpen(true)}
        aria-label="Search guidance pages"
        aria-haspopup="dialog"
      >
        <Search className={styles.searchTriggerIcon} aria-hidden />
        <span className={styles.searchTriggerText}>Search pages…</span>
        <kbd className={styles.searchKbd}>{shortcut}</kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search pages"
        description="Search guidance pages and jump to them"
        className="top-1/2 w-full max-w-xl -translate-y-1/2 shadow-none sm:max-w-xl"
      >
        <Command>
          <CommandInput placeholder="Search pages…" autoFocus />
          <CommandList>
            <CommandEmpty>No pages found.</CommandEmpty>
            {NAV.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={`${item.title} ${group.label} ${item.href}`}
                    onSelect={() => handleSelect(item.href)}
                  >
                    <item.icon aria-hidden />
                    <span>{item.title}</span>
                    {/* CommandShortcut keeps the group chip on one right-aligned
                        column (its data-slot also hides CommandItem's check
                        icon, whose own ml-auto used to split the free space). */}
                    <CommandShortcut className="ml-auto pl-2 tracking-normal">
                      <Pill tone="neutral" className="text-[10px] font-medium">
                        {group.label}
                      </Pill>
                    </CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
