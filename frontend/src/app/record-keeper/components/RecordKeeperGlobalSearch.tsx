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
} from "@/components/ui/command";
import { NAV } from "@/components/record-keeper-sidebar";
import styles from "../record-keeper.module.css";

/**
 * Record-keeper global search: a topbar trigger that opens the command palette
 * and jumps to any page in the desk's sidebar (grouped by workspace, same as
 * the sidebar). Ctrl/⌘K opens it from anywhere on the desk.
 */
export function RecordKeeperGlobalSearch() {
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
        aria-label="Search record keeper pages"
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
        description="Search record keeper pages and jump to them"
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
                    <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">
                      {group.label}
                    </span>
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
