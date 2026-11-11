/** Philippine mobile number: 09XXXXXXXXX (11 digits) or +639XXXXXXXXX. */
export const PH_MOBILE_PATTERN = /^(?:\+63|0)9\d{9}$/;

/** Strip spaces/hyphens so "0917-123-4567" and "+63 917 123 4567" pass. */
export function normalizePhone(value: string): string {
  return value.replace(/[\s-]/g, "");
}

/** Input mask: keep digits, a leading "+", spaces and hyphens; drop letters. */
export function sanitizePhoneInput(value: string): string {
  return value.replace(/[^\d+\s-]/g, "").replace(/(?!^)\+/g, "");
}

/** Empty is allowed (the field is optional). */
export function isValidPhMobile(value: string): boolean {
  const normalized = normalizePhone(value.trim());
  return normalized === "" || PH_MOBILE_PATTERN.test(normalized);
}

export const PH_MOBILE_MESSAGE =
  "Enter a valid Philippine mobile number (09XXXXXXXXX or +639XXXXXXXXX).";
