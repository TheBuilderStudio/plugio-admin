/**
 * Plugio Admin — Input Validation
 *
 * Validates all inputs before they reach the database layer.
 * Used in both Server Actions and database query functions.
 */

import { MAX_SEARCH_LENGTH } from "@/constants";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Validate a user ID parameter from a URL path segment.
 * User IDs in plugio_db are UUIDs (v4/v7).
 */
export function validateUserId(id: unknown): string {
  if (typeof id !== "string" || !id.trim()) {
    throw new ValidationError("User ID is required");
  }

  const trimmed = id.trim();

  // UUID format: 8-4-4-4-12 hex chars
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(trimmed)) {
    throw new ValidationError("Invalid user ID format");
  }

  return trimmed;
}

/**
 * Validate and sanitize a search query.
 * Removes dangerous characters that could be used for LIKE injection.
 */
export function validateSearch(input: unknown): string {
  if (!input || typeof input !== "string") return "";

  // Trim and limit length
  let sanitized = input.trim().slice(0, MAX_SEARCH_LENGTH);

  // Check for suspicious SQL patterns (defense in depth — queries are parameterized anyway).
  // NOTE: Do NOT use /g flag here — RegExp.test() with /g is stateful (lastIndex),
  // which alternates between true/false on successive calls against the same string.
  const suspiciousPatterns = [
    /--/, // SQL comment
    /\/\*/, // Block comment
    /;\s*(DROP|DELETE|UPDATE|INSERT|CREATE|ALTER)/i, // Statement chaining
    /\bUNION\b/i, // UNION injection
    /\bOR\b\s+\d+\s*=\s*\d+/i, // OR 1=1
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(sanitized)) {
      // Strip the suspicious part rather than blocking — keeps UX smooth
      // while preventing any accidental injection
      sanitized = sanitized.replace(pattern, "");
    }
  }

  return sanitized;
}

/**
 * Validate that a status filter value is one of the allowed enum values.
 */
export function validateStatusFilter(
  status: unknown
): "ALL" | "PENDING" | "APPROVED" | "REJECTED" {
  const allowed = ["ALL", "PENDING", "APPROVED", "REJECTED"] as const;
  if (typeof status === "string" && allowed.includes(status as any)) {
    return status as "ALL" | "PENDING" | "APPROVED" | "REJECTED";
  }
  return "ALL";
}

/**
 * Validate a page number from query params.
 */
export function validatePage(page: unknown): number {
  const parsed = parseInt(String(page), 10);
  if (isNaN(parsed) || parsed < 1) return 1;
  if (parsed > 10000) return 1; // sanity ceiling
  return parsed;
}
