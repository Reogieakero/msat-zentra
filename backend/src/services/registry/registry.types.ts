import type { GradeLevel } from "../../generated/prisma/client.js";

// Shared service-layer contract for the records-desk services (registrar +
// record keeper). The HTTP layer builds this from the authenticated request;
// services never touch req/res directly. Every read/write below is scoped to
// `band` (G11–12 for the registrar, G7–10 for the record keeper).
export interface RegistryContext {
  userId: string;
  role: string;
  band: GradeLevel[];
}

// Desk identity for the copy that differs between the two desks (audit
// reasons, employee-id prefixes, deny defaults, band-scope messages).
// Response shapes and query semantics stay identical; only these strings vary.
export interface DeskIdentity {
  /** "Registrar" | "Record Keeper" — used in audit reasons and messages. */
  deskNoun: string;
  /** "registrar" | "record-keeper" — used in BAND_SCOPE errors. */
  scopeNoun: string;
  /** Employee-id prefix for profile upserts: "R-" | "RK-". */
  employeePrefix: string;
}

export const REGISTRAR_IDENTITY: DeskIdentity = {
  deskNoun: "Registrar",
  scopeNoun: "registrar",
  employeePrefix: "R-",
};

export const RECORD_KEEPER_IDENTITY: DeskIdentity = {
  deskNoun: "Record Keeper",
  scopeNoun: "record-keeper",
  employeePrefix: "RK-",
};
