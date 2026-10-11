/** Canonical cache-tag names + TTLs. Import everywhere instead of string literals. */
export const CACHE_TAGS = {
  overview: "overview",
  adm: "adm",
  admDevices: "adm-devices",
  referrals: "referrals",
  interventions: "interventions",
  grades: "grades",
  attendance: "attendance",
  anecdotal: "anecdotal",
  health: "health",
  guidance: "guidance",
  nurse: "nurse",
  academics: "academics",
  sections: "sections",
  subjects: "subjects",
  audit: "audit",
  reports: "reports",
  notifications: "notifications",
  sessions: "sessions",
  risk: "risk",
  registrar: "registrar",
  recordKeeper: "record-keeper",
  teacher: "teacher",
  roster: "roster",
  directory: "directory",
} as const;

/** Short TTLs for live dashboards/counts; long for static lookups. */
export const CACHE_TTLS = {
  dashboard: 15,
  list: 30,
  semiStatic: 300,
  lookup: 3600,
} as const;
