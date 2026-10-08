"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import BranchedMenu from "@/components/nav/BranchedMenu";
import { scrollToSection, settingsSections } from "./components/SettingsNav";
import { ProfileCard } from "./components/ProfileCard";
import { PaletteCard } from "./components/PaletteCard";
import { PasswordCard } from "./components/PasswordCard";
import { AdviserCard } from "./components/AdviserCard";
import { MasterTeacherCard } from "./components/MasterTeacherCard";
import { useTheme } from "@/components/providers";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { useTeacherOverview } from "@/services/teacher/overview.service";
export default function TeacherSettingsPage() {
  const { theme, setTheme } = useTheme();
  const overview = useTeacherOverview();
  const isDark = theme === "dark";
  const masterTeacherEligible = overview.data?.masterTeacherEligible ?? false;
  const links = settingsSections(masterTeacherEligible);
  const [activeSection, setActiveSection] = React.useState(links[0]?.id ?? "section-profile");
  const handleSelectSection = (id: string) => {
    setActiveSection(id);
    scrollToSection(id);
  };
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your profile, appearance, and account security.</p>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-24">
          <BranchedMenu items={[{ label: "Settings", children: links.map((l) => ({ value: l.id, label: l.label, icon: <l.Icon size={16} strokeWidth={1.8} aria-hidden="true" /> })) }]} defaultOpen={[0]} defaultActive={activeSection} onSelect={(value) => handleSelectSection(value)} width={240} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <ProfileCard />
          <AdviserCard />
          <MasterTeacherCard />
          <section id="section-appearance" aria-labelledby="settings-appearance" className={`${assign.card} scroll-mt-24`}>
            <span className={assign.glowClip} aria-hidden="true"><span className={assign.cardGlow} /></span>
            <h2 id="settings-appearance" className="relative text-base font-semibold">Appearance</h2>
            <p className="relative mt-1 text-sm text-muted-foreground">Applies instantly across the whole workspace.</p>
            <div className="relative mt-4">
              <p className="mb-2 text-sm font-medium">Theme</p>
              <div className="flex gap-2" role="radiogroup" aria-label="Theme">
                <Button type="button" variant={!isDark ? "default" : "outline"} role="radio" aria-checked={!isDark} onClick={() => setTheme("light")} className="flex-1">Light</Button>
                <Button type="button" variant={isDark ? "default" : "outline"} role="radio" aria-checked={isDark} onClick={() => setTheme("dark")} className="flex-1">Dark</Button>
              </div>
            </div>
          </section>
          <PaletteCard />
          <PasswordCard />
        </div>
      </div>
    </section>
  );
}
