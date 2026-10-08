"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";

export type SettingsDesk =
  | "teacher"
  | "coordinator"
  | "guidance"
  | "nurse"
  | "principal"
  | "registrar"
  | "record-keeper";

const PROFILE_ENDPOINT: Record<SettingsDesk, string> = {
  teacher: "/api/teacher/settings/profile",
  coordinator: "/api/adm/settings/profile",
  guidance: "/api/guidance/settings/profile",
  nurse: "/api/nurse/settings/profile",
  principal: "/api/principal/settings/profile",
  registrar: "/api/registrar/settings/profile",
  "record-keeper": "/api/record-keeper/settings/profile",
};

export interface ProfileSettings {
  fullName: string;
  photoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

export function profileSettingsKey(
  desk: SettingsDesk,
  userId: string | null | undefined,
) {
  return [`${desk}-profile-settings`, userId ?? "anon"] as const;
}

export async function fetchProfileSettings(
  desk: SettingsDesk,
): Promise<ProfileSettings> {
  const { data } = await apiClient.get<ProfileSettings>(
    PROFILE_ENDPOINT[desk],
  );
  return data;
}

const SETTINGS_STALE_MS = 30_000;
const SETTINGS_GC_MS = 5 * 60_000;

export function useProfileSettings(desk: SettingsDesk) {
  const session = useSession();
  const userId = session?.sub ?? null;
  return useQuery({
    queryKey: profileSettingsKey(desk, userId),
    queryFn: () => fetchProfileSettings(desk),
    enabled: !!userId,
    staleTime: SETTINGS_STALE_MS,
    gcTime: SETTINGS_GC_MS,
  });
}

function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastForeground(hex: string): string {
  return luminance(hex) > 0.4 ? "#18181b" : "#fafafa";
}

export function applyPalette(primary: string | null, secondary: string | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (primary) {
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--primary-foreground", contrastForeground(primary));
  } else {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--primary-foreground");
  }
  if (secondary) {
    root.style.setProperty("--secondary", secondary);
    root.style.setProperty("--secondary-foreground", contrastForeground(secondary));
  } else {
    root.style.removeProperty("--secondary");
    root.style.removeProperty("--secondary-foreground");
  }
}

export function PaletteGate({ desk }: { desk: SettingsDesk }) {
  const { data } = useProfileSettings(desk);
  const signature = data
    ? `${data.primaryColor ?? ""}|${data.secondaryColor ?? ""}`
    : "none";
  React.useEffect(() => {
    if (!data || (!data.primaryColor && !data.secondaryColor)) {
      applyPalette(null, null);
      return;
    }
    applyPalette(data.primaryColor, data.secondaryColor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  return null;
}

export type TeacherProfileSettings = ProfileSettings;
export function teacherProfileSettingsKey(
  teacherId: string | null | undefined,
) {
  return profileSettingsKey("teacher", teacherId);
}
export function fetchTeacherProfileSettings(): Promise<TeacherProfileSettings> {
  return fetchProfileSettings("teacher");
}
export function useTeacherProfileSettings() {
  return useProfileSettings("teacher");
}
export function TeacherPaletteGate() {
  return PaletteGate({ desk: "teacher" });
}

export type CoordinatorProfileSettings = ProfileSettings;
export function coordinatorProfileSettingsKey(
  coordinatorId: string | null | undefined,
) {
  return profileSettingsKey("coordinator", coordinatorId);
}
export function fetchCoordinatorProfileSettings(): Promise<CoordinatorProfileSettings> {
  return fetchProfileSettings("coordinator");
}
export function useCoordinatorProfileSettings() {
  return useProfileSettings("coordinator");
}
export function CoordinatorPaletteGate() {
  return PaletteGate({ desk: "coordinator" });
}

export type GuidanceProfileSettings = ProfileSettings;
export function guidanceProfileSettingsKey(
  counselorId: string | null | undefined,
) {
  return profileSettingsKey("guidance", counselorId);
}
export function fetchGuidanceProfileSettings(): Promise<GuidanceProfileSettings> {
  return fetchProfileSettings("guidance");
}
export function useGuidanceProfileSettings() {
  return useProfileSettings("guidance");
}
export function GuidancePaletteGate() {
  return PaletteGate({ desk: "guidance" });
}

export type NurseProfileSettings = ProfileSettings;
export function nurseProfileSettingsKey(nurseId: string | null | undefined) {
  return profileSettingsKey("nurse", nurseId);
}
export function fetchNurseProfileSettings(): Promise<NurseProfileSettings> {
  return fetchProfileSettings("nurse");
}
export function useNurseProfileSettings() {
  return useProfileSettings("nurse");
}
export function NursePaletteGate() {
  return PaletteGate({ desk: "nurse" });
}

export type PrincipalProfileSettings = ProfileSettings;
export function principalProfileSettingsKey(
  principalId: string | null | undefined,
) {
  return profileSettingsKey("principal", principalId);
}
export function fetchPrincipalProfileSettings(): Promise<PrincipalProfileSettings> {
  return fetchProfileSettings("principal");
}
export function usePrincipalProfileSettings() {
  return useProfileSettings("principal");
}
export function PrincipalPaletteGate() {
  return PaletteGate({ desk: "principal" });
}

export type RegistrarProfileSettings = ProfileSettings;
export function registrarProfileSettingsKey(
  registrarId: string | null | undefined,
) {
  return profileSettingsKey("registrar", registrarId);
}
export function fetchRegistrarProfileSettings(): Promise<RegistrarProfileSettings> {
  return fetchProfileSettings("registrar");
}
export function useRegistrarProfileSettings() {
  return useProfileSettings("registrar");
}
export function RegistrarPaletteGate() {
  return PaletteGate({ desk: "registrar" });
}

export type RecordKeeperProfileSettings = ProfileSettings;
export function recordKeeperProfileSettingsKey(
  recordKeeperId: string | null | undefined,
) {
  return profileSettingsKey("record-keeper", recordKeeperId);
}
export function fetchRecordKeeperProfileSettings(): Promise<RecordKeeperProfileSettings> {
  return fetchProfileSettings("record-keeper");
}
export function useRecordKeeperProfileSettings() {
  return useProfileSettings("record-keeper");
}
export function RecordKeeperPaletteGate() {
  return PaletteGate({ desk: "record-keeper" });
}
