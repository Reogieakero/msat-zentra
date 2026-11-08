export interface InterventionInsightKpis {
  total: number;
  ongoing: number;
  resolved: number;
  unresolved: number;
  successRate: number;
  avgResolutionDays: number | null;
  sessionsTotal: number;
  sessionsCompleted: number;
  sessionCompletionRate: number;
}

export interface InterventionInsightTrendRow {
  month: string;
  label: string;
  opened: number;
  resolved: number;
  sessions: number;
  completedSessions: number;
}

export interface InterventionInsightOutcomeRow {
  key: string;
  label: string;
  total: number;
  resolved: number;
  ongoing: number;
  unresolved: number;
  rate: number;
}

export interface InterventionInsightSessionTypeRow {
  type: string;
  label: string;
  total: number;
  scheduled: number;
  completed: number;
  cancelled: number;
}

export interface InterventionInsightSectionRow extends InterventionInsightOutcomeRow {
  section: string;
  grade: string;
}

export interface InterventionInsightsData {
  termLabel: string;
  generatedAt: string;
  kpis: InterventionInsightKpis;
  monthlyTrend: InterventionInsightTrendRow[];
  successByRisk: InterventionInsightOutcomeRow[];
  successByGrade: InterventionInsightOutcomeRow[];
  sessionsByType: InterventionInsightSessionTypeRow[];
  sectionHeat: InterventionInsightSectionRow[];
}
