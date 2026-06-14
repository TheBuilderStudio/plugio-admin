"use server";

/**
 * Plugio Admin — Beta Access Server Actions
 *
 * Server Actions for approving and rejecting beta access requests.
 *
 * Security contract:
 * 1. requireAdmin() validates session and email whitelist on EVERY action
 * 2. validateUserId() ensures the userId from the form is a valid UUID
 * 3. All DB operations use parameterized queries (no SQL injection possible)
 * 4. Every action is logged via logAdminAction()
 * 5. revalidatePath() triggers UI refresh after mutation
 */

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/security";
import { validateUserId } from "@/lib/validation";
import {
  approveBetaUser,
  rejectBetaUser,
  getUserEmailById,
} from "@/lib/db/queries";
import { logAdminAction } from "@/lib/logger";
import type { ActionResult } from "@/types";

/**
 * Approve a user's beta access request.
 *
 * Database effect:
 *   users SET access_status = 'APPROVED', beta_approved = 1, is_whitelisted = 1
 *
 * This mirrors the "approval" operation that was previously done via raw SQL.
 * After this runs, User.hasFullPlatformBetaAccess() returns true and the
 * Spring Boot BetaAccessFilter will allow the user through.
 */
export async function approveBetaAction(
  userId: string
): Promise<ActionResult> {
  try {
    // 1. Validate admin session (throws if unauthorized)
    const session = await requireAdmin();

    // 2. Validate input
    const validUserId = validateUserId(userId);

    // 3. Get user info for logging
    const targetUser = await getUserEmailById(validUserId);
    if (!targetUser) {
      return { success: false, message: "User not found", error: "NOT_FOUND" };
    }

    // 4. Perform the database update
    await approveBetaUser(validUserId);

    // 5. Log the action
    logAdminAction({
      action: "BETA_APPROVE",
      adminEmail: session.user?.email!,
      targetUserId: validUserId,
      targetEmail: targetUser.email,
      details: `Approved beta access for ${targetUser.name ?? targetUser.email}`,
    });

    // 6. Invalidate cached page data so the UI reflects the change
    revalidatePath("/admin/beta");
    revalidatePath(`/admin/users/${validUserId}`);
    revalidatePath("/admin/dashboard");

    return {
      success: true,
      message: `Beta access approved for ${targetUser.name ?? targetUser.email}`,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    if (message.startsWith("UNAUTHORIZED") || message.startsWith("FORBIDDEN")) {
      return {
        success: false,
        message: "Access denied",
        error: "UNAUTHORIZED",
      };
    }

    console.error("[approveBetaAction] Error:", error);
    return {
      success: false,
      message: "Failed to approve beta access. Please try again.",
      error: "SERVER_ERROR",
    };
  }
}

/**
 * Reject a user's beta access request.
 *
 * Database effect:
 *   users SET access_status = 'REJECTED', beta_approved = 0
 */
export async function rejectBetaAction(userId: string): Promise<ActionResult> {
  try {
    // 1. Validate admin session
    const session = await requireAdmin();

    // 2. Validate input
    const validUserId = validateUserId(userId);

    // 3. Get user info for logging
    const targetUser = await getUserEmailById(validUserId);
    if (!targetUser) {
      return { success: false, message: "User not found", error: "NOT_FOUND" };
    }

    // 4. Perform the database update
    await rejectBetaUser(validUserId);

    // 5. Log the action
    logAdminAction({
      action: "BETA_REJECT",
      adminEmail: session.user?.email!,
      targetUserId: validUserId,
      targetEmail: targetUser.email,
      details: `Rejected beta access for ${targetUser.name ?? targetUser.email}`,
    });

    // 6. Invalidate cached page data
    revalidatePath("/admin/beta");
    revalidatePath(`/admin/users/${validUserId}`);
    revalidatePath("/admin/dashboard");

    return {
      success: true,
      message: `Beta access rejected for ${targetUser.name ?? targetUser.email}`,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    if (message.startsWith("UNAUTHORIZED") || message.startsWith("FORBIDDEN")) {
      return {
        success: false,
        message: "Access denied",
        error: "UNAUTHORIZED",
      };
    }

    console.error("[rejectBetaAction] Error:", error);
    return {
      success: false,
      message: "Failed to reject beta access. Please try again.",
      error: "SERVER_ERROR",
    };
  }
}
