/**
 * Plugio Admin — Security Utilities
 *
 * Every Server Action and every page that reads data must call requireAdmin()
 * before doing anything. This ensures that even if middleware is somehow bypassed,
 * unauthorized access is still blocked at the data layer.
 *
 * Defense in depth:
 *   Layer 1: middleware.ts  — blocks unauthenticated/unauthorized route access
 *   Layer 2: requireAdmin() — validates every server action and page
 *   Layer 3: DB queries     — parameterized queries prevent SQL injection
 */

import { auth } from "@/auth";
import { ADMIN_EMAILS } from "@/constants";
import type { Session } from "next-auth";
import { normalizeAdminEmail } from "@/lib/security/emails";

export { isAdminEmail, normalizeAdminEmail } from "@/lib/security/emails";

/**
 * Validates that the current session belongs to an authorized admin.
 * Throws if not authenticated or email is not whitelisted.
 *
 * Usage (in Server Actions):
 *   const session = await requireAdmin()
 *   // session.user.email is guaranteed valid here
 */
export async function requireAdmin(): Promise<Session> {
  const session = await auth();
  const email = normalizeAdminEmail(session?.user?.email);

  if (!email) {
    throw new Error("UNAUTHORIZED: No active session");
  }

  if (!ADMIN_EMAILS.includes(email)) {
    throw new Error(`FORBIDDEN: ${email} is not an authorized admin`);
  }

  return session!;
}

/**
 * Server-side read-only gate. UI flags alone are not enough — every mutating
 * server action must call this after requireAdmin().
 */
export function assertAdminWritable(): void {
  const readOnly =
    process.env.READ_ONLY_MODE === "true" ||
    process.env.NEXT_PUBLIC_READ_ONLY_MODE === "true";
  if (readOnly) {
    throw new Error("FORBIDDEN: Admin panel is in read-only mode");
  }
}

/**
 * requireAdmin + writable check for mutations.
 */
export async function requireWritableAdmin(): Promise<Session> {
  const session = await requireAdmin();
  assertAdminWritable();
  return session;
}

/**
 * Check if an email is in the admin whitelist.
 * Safe to call from any context.
 */
// isAdminEmail re-exported from ./emails

/**
 * Validate a UUID (v4/v7) format for user IDs.
 * Prevents path traversal or injection via user ID parameters.
 */
export function isValidUserId(id: string | null | undefined): id is string {
  if (!id) return false;
  // UUID v4/v7 pattern: 8-4-4-4-12 hex chars
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id
  );
}

/**
 * Sanitize a search query string.
 * Removes leading/trailing whitespace and limits length.
 */
export function sanitizeSearch(
  input: string | null | undefined,
  maxLength = 100
): string {
  if (!input) return "";
  return input.trim().slice(0, maxLength);
}

/** Require a non-empty control reason for grant/revoke mutations. */
export function requireControlReason(
  reason: string | null | undefined,
  fieldLabel = "Reason"
): string {
  const trimmed = typeof reason === "string" ? reason.trim() : "";
  if (trimmed.length < 3) {
    throw new Error(
      `VALIDATION: ${fieldLabel} is required (at least 3 characters) for this control action`
    );
  }
  return trimmed.slice(0, 255);
}
