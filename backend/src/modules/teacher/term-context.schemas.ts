import { z } from "zod";

/** Adviser acknowledgement of the roster they see for the selected term. */
export const termContextConfirmSchema = z.object({
  kind: z.enum(["roster", "classes"]).default("roster"),
  fingerprint: z.string().trim().regex(/^[a-f0-9]{64}$/, "Invalid roster fingerprint"),
  /**
   * Answer to "same students and classes as last term?".
   * true = keep the previous term's roster/classes as the default view,
   * false = start this term with an empty class list (students stay on the
   * year-shared roster). Display-only; nothing is copied.
   */
  sameAsPrevious: z.boolean().default(true),
});
