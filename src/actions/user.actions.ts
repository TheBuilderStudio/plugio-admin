"use server";

/**
 * Plugio Admin — User Management Server Actions
 *
 * Currently handles logout. Future: user disable/enable if needed.
 */

import { requireAdmin } from "@/lib/security";
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
      adminEmail: session.user?.email!,
      details: "Admin logged out",
    });
  } catch {
    // If requireAdmin fails, still proceed with logout
  }

  await signOut({ redirectTo: "/login" });
}
