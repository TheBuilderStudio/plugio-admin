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

  if (!session?.user?.email) {
    throw new Error("UNAUTHORIZED: No active session");
  }

  if (!ADMIN_EMAILS.includes(session.user.email)) {
    throw new Error(
      `FORBIDDEN: ${session.user.email} is not an authorized admin`
    );
  }

  return session;
}

/**
 * Check if an email is in the admin whitelist.
 * Safe to call from any context.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email);
}

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
