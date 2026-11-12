/**
 * Monotonic version for the guidance live-cohort memo.
 *
 * `getLiveCohortStudents` memoizes its expensive grades + attendance scan for a
 * few seconds. The risk engine bumps this version whenever it writes a flag
 * change, so a desk that refetches right after a detection can never read a
 * cohort that was computed before it.
 */
let version = 0;

export function riskCohortVersion(): number {
  return version;
}

export function bumpRiskCohortVersion(): void {
  version += 1;
}
