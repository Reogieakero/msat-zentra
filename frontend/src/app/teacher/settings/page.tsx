"use client";
import * as React from "react";
import { Check, Moon, Palette, Sun } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { ProfileCard } from "./components/ProfileCard";
import { TeacherPageHeader } from "../components/TeacherPageHeader";
import { ZentraPageHeaderSkeleton, KanbanBoardSkeleton, IconRailSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { PasswordCard } from "./components/PasswordCard";
import { AdviserCard } from "./components/AdviserCard";
import { DataSyncCard } from "./components/DataSyncCard";
import { MasterTeacherCard } from "./components/MasterTeacherCard";
import { settingsSections } from "./components/SettingsNav";
import { SettingsRail } from "./components/SettingsRail";
import { useTheme } from "@/components/providers";
import sectionStyles from "./components/settings-section.module.css";
import { useTeacherOverview } from "@/services/teacher/overview.service";
import { useTeacherProfileSettings } from "@/services/settings/profile-settings";
export default function TeacherSettingsPage() {
  const { theme, setTheme } = useTheme();
  const overview = useTeacherOverview();
  const profile = useTeacherProfileSettings();
  const isDark = theme === "dark";
  const masterTeacherEligible = overview.data?.masterTeacherEligible ?? false;
  const links = React.useMemo(
    () => settingsSections(masterTeacherEligible),
    [masterTeacherEligible],
  );
  const [activeId, setActiveId] = React.useState("section-profile");

  // Scroll-spy: highlight the rail icon for the section in view.
  // Re-attaches when sections mount (profile loads first, overview-gated
  // cards like Master Teacher arrive later).
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

  // Gate on the fast profile query — overview-gated cards (pills, adviser,
  // master teacher) skeleton in place instead of blocking the whole page.
  if (profile.isPending) {
    return (
      <section className={`mx-auto flex w-full max-w-3xl flex-col gap-3 ${sectionStyles.page}`} aria-busy="true" aria-label="Loading settings">
        <ZentraPageHeaderSkeleton />
        <div className={sectionStyles.layout}>
          <div className={`flex w-full min-w-0 flex-col gap-3 ${sectionStyles.stack}`}>
            {Array.from({ length: 6 }).map((_, i) => (
              <KanbanBoardSkeleton
                key={i}
                rows={i === 0 ? 3 : i === 4 ? 2 : 3}
                titleWidth={i === 0 ? "7rem" : "6rem"}
                showDescription={i === 4}
              />
            ))}
          </div>
          <IconRailSkeleton count={5} />
        </div>
      </section>
    );
  }
  return (
    <section className={`mx-auto flex w-full max-w-3xl flex-col gap-3 ${sectionStyles.page}`}>
      <TeacherPageHeader
        title="Settings"
        description="Your profile, data sharing, appearance, and account security."
      />
      <div className={sectionStyles.layout}>
        <div className={`flex w-full min-w-0 flex-col gap-3 ${sectionStyles.stack}`}>
          <ProfileCard />
          <AdviserCard />
          <DataSyncCard />
          <MasterTeacherCard />
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
                  onClick={() => setTheme("light")}
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
                  onClick={() => setTheme("dark")}
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
