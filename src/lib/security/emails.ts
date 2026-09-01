/**
 * Lightweight email helpers safe for Edge middleware.
 * Keep this file free of next-auth / Node-only imports.
 */

import { ADMIN_EMAILS } from "@/constants";

export function normalizeAdminEmail(
  email: string | null | undefined
): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const normalized = normalizeAdminEmail(email);
  if (!normalized) return false;
  return ADMIN_EMAILS.includes(normalized);
}
