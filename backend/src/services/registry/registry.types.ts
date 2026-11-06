import type { DeskIdentity } from "../../lib/request-context.js";

export type { DeskIdentity, RegistryContext } from "../../lib/request-context.js";

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
