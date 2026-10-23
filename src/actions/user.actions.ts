"use server";

/**
 * Plugio Admin — User Management Server Actions
 *
 * Currently handles logout. Future: user disable/enable if needed.
 */

import { requireAdmin, getAdminEmail } from "@/lib/security";
import { logAdminAction } from "@/lib/logger";
import { signOut } from "@/auth";

/**
 * Sign out the current admin session.
 * Logs the logout event before signing out.
 */
export async function logoutAction(): Promise<void> {
  try {
    const session = await requireAdmin();

    logAdminAction({
      action: "LOGOUT",
      adminEmail: getAdminEmail(session),
      details: "Admin logged out",
    });
  } catch {
    // If requireAdmin fails, still proceed with logout
  }

  await signOut({ redirectTo: "/login" });
}

export interface UserSearchHit {
  id: string;
  name: string | null;
  email: string;
}

/** Quick lookup for the command palette: name, email or user id. Read-only. */
export async function searchUsersAction(query: string): Promise<UserSearchHit[]> {
  await requireAdmin();
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return [];
  const { searchUsersQuick } = await import("@/lib/db/queries");
  return searchUsersQuick(q);
}
