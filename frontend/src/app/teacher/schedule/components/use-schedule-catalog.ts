"use client";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import type { DayConfig } from "./schedule-time";
import type { ScheduleSubject } from "../page";
export type CatalogTeacher = { id: string; name: string; code: string | null; linked: boolean };
export function useScheduleCatalog(termKey: string) {
  void useTerm;
  const subjectsQuery = useQuery<{ subjects: ScheduleSubject[] }>({
    queryKey: ["teacher-schedule-subjects", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ subjects: ScheduleSubject[] }>(
        "/api/teacher/schedule/subjects",
      );
      return data;
    },
  });
  const teachersQuery = useQuery<{ teachers: CatalogTeacher[] }>({
    queryKey: ["teacher-schedule-teachers", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ teachers: CatalogTeacher[] }>(
        "/api/teacher/schedule/teachers",
      );
      return data;
    },
  });
  const configQuery = useQuery<{ config: DayConfig }>({
    queryKey: ["teacher-schedule-config", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ config: DayConfig }>("/api/teacher/schedule/config");
      return data;
    },
  });
  const subjects = subjectsQuery.data?.subjects ?? [];
  const teachers = teachersQuery.data?.teachers ?? [];
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const teacherById = new Map(teachers.map((t) => [t.id, t]));
  return {
    subjectsQuery,
    teachersQuery,
    configQuery,
    subjects,
    teachers,
    subjectById,
    teacherById,
    activeConfig: configQuery.data?.config ?? null,
  };
}
