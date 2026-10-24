"use client";

import * as React from "react";
import { Check, Moon, Palette, Sun } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { CoordinatorPageHeader } from "../components/CoordinatorPageHeader";
import {
  ZentraPageHeaderSkeleton,
  KanbanBoardSkeleton,
  IconRailSkeleton,
} from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { ProfileCard } from "./components/ProfileCard";
import { PasswordCard } from "./components/PasswordCard";
import { coordinatorSettingsSections } from "./components/SettingsNav";
import { SettingsRail } from "./components/SettingsRail";
import { useTheme } from "@/components/providers";
import { useDock } from "@/components/dock/dock-store";
import sectionStyles from "./components/settings-section.module.css";
import { useCoordinatorProfileSettings } from "@/services/settings/profile-settings";

export default function CoordinatorSettingsPage() {
  const { theme, setTheme } = useTheme();
  const dock = useDock();
  const profile = useCoordinatorProfileSettings();
  const isDark = theme === "dark";
  const links = React.useMemo(() => coordinatorSettingsSections(), []);
  const [activeId, setActiveId] = React.useState("section-profile");

  // Theme is instant/local, but still reports through the shared Dock so
  // every action on this page lands in the same bottom-right task list.
  const applyTheme = (next: "light" | "dark") => {
    setTheme(next);
    let taskId: string | null = null;
    try {
      taskId = dock.startTask({
        kind: "generic",
        title: "Appearance updated",
        description: `${next === "dark" ? "Dark" : "Light"} theme`,
      });
    } catch {
      taskId = null;
    }
    if (taskId) dock.completeTask(taskId, `${next === "dark" ? "Dark" : "Light"} theme applied.`);
  };

  // Scroll-spy: highlight the rail icon for the section in view.
  React.useEffect(() => {
    if (profile.isPending) return;
    const els = links
      .map((l) => document.getElementById(l.id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [links, profile.isPending]);

  // Gate on the fast profile query — the sections mount together so the
  // rail's scroll-spy finds every anchor in one pass.
  if (profile.isPending) {
    return (
      <section className={`mx-auto flex w-full max-w-3xl flex-col gap-3 ${sectionStyles.page}`} aria-busy="true" aria-label="Loading settings">
        <ZentraPageHeaderSkeleton />
        <div className={sectionStyles.layout}>
          <div className={`flex w-full min-w-0 flex-col gap-3 ${sectionStyles.stack}`}>
            {Array.from({ length: 3 }).map((_, i) => (
              <KanbanBoardSkeleton
                key={i}
                rows={i === 0 ? 3 : 2}
                titleWidth={i === 0 ? "7rem" : "6rem"}
                showDescription={i === 1}
              />
            ))}
          </div>
          <IconRailSkeleton count={3} />
        </div>
      </section>
    );
  }

  return (
    <section className={`mx-auto flex w-full max-w-3xl flex-col gap-3 ${sectionStyles.page}`}>
      <CoordinatorPageHeader
        title="Settings"
        description="Your profile, appearance, and account security."
      />
      <div className={sectionStyles.layout}>
        <div className={`flex w-full min-w-0 flex-col gap-3 ${sectionStyles.stack}`}>
          <ProfileCard />
          <div id="section-appearance" className={sectionStyles.boardWrap}>
            <KanbanBoard
              title="Appearance"
              icon={<Palette size={14} aria-hidden="true" />}
              description="Applies instantly across the whole workspace. Pick a card."
              ariaLabel="Appearance settings"
            >
              <p className="px-1 text-sm font-medium">Theme</p>
              <div className={sectionStyles.themeGrid} role="radiogroup" aria-label="Theme">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!isDark}
                  onClick={() => applyTheme("light")}
                  className={`${sectionStyles.themeOption} ${!isDark ? sectionStyles.themeOptionActive : ""}`}
                >
                  {!isDark ? (
                    <span className={sectionStyles.themeCheck} aria-hidden="true">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  ) : null}
                  <span className={`${sectionStyles.themePreview} ${sectionStyles.themePreviewLight}`} aria-hidden="true">
                    <span className={`${sectionStyles.themePreviewBar} ${sectionStyles.themePreviewBarLight}`} style={{ width: "70%" }} />
                    <span className={`${sectionStyles.themePreviewBar} ${sectionStyles.themePreviewBarLight}`} style={{ width: "100%" }} />
                    <span className={sectionStyles.themePreviewAccent} />
                  </span>
                  <span className={sectionStyles.themeLabel}>
                    <Sun size={14} aria-hidden="true" />
                    Light
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isDark}
                  onClick={() => applyTheme("dark")}
                  className={`${sectionStyles.themeOption} ${isDark ? sectionStyles.themeOptionActive : ""}`}
                >
                  {isDark ? (
                    <span className={sectionStyles.themeCheck} aria-hidden="true">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  ) : null}
                  <span className={`${sectionStyles.themePreview} ${sectionStyles.themePreviewDark}`} aria-hidden="true">
                    <span className={`${sectionStyles.themePreviewBar} ${sectionStyles.themePreviewBarDark}`} style={{ width: "70%" }} />
                    <span className={`${sectionStyles.themePreviewBar} ${sectionStyles.themePreviewBarDark}`} style={{ width: "100%" }} />
                    <span className={sectionStyles.themePreviewAccent} />
                  </span>
                  <span className={sectionStyles.themeLabel}>
                    <Moon size={14} aria-hidden="true" />
                    Dark
                  </span>
                </button>
              </div>
            </KanbanBoard>
          </div>
          <PasswordCard />
        </div>
        <SettingsRail links={links} activeId={activeId} onSelect={setActiveId} />
      </div>
    </section>
  );
}
