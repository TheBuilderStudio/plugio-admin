"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/security";
import { validateUserId } from "@/lib/validation";
import { pool } from "@/lib/db";
import { logAdminAction } from "@/lib/logger";

export async function grantTrial(userId: string, days: number = 14) {
  const session = await requireAdmin();

  // Validate userId before any DB operation — matches beta.actions.ts pattern
  const validUserId = validateUserId(userId);

  try {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + days);

    await pool.execute(
      `
      INSERT INTO subscriptions (id, user_id, subscription_status, trial_ends_at, has_used_trial, created_at, updated_at)
      VALUES (UUID(), ?, 'TRIALING', ?, 1, NOW(6), NOW(6))
      ON DUPLICATE KEY UPDATE
        subscription_status = 'TRIALING',
        trial_ends_at = ?,
        has_used_trial = 1,
        updated_at = NOW(6)
      `,
      [validUserId, trialEndsAt, trialEndsAt]
    );

    logAdminAction({
      action: "USER_ENABLE",
      adminEmail: session.user?.email ?? "Unknown",
      targetUserId: validUserId,
      details: `Granted ${days}-day trial`,
    });

    revalidatePath(`/admin/users/${validUserId}`);
    return { success: true, message: `Granted ${days}-day trial` };
  } catch (error: any) {
    console.error("[grantTrial] Error:", error);
    return { success: false, message: "Failed to grant trial", error: "Failed to grant trial" };
  }
}

export async function grantLifetime(userId: string) {
  const session = await requireAdmin();
  const validUserId = validateUserId(userId);

  try {
    // Set pro_period_end_at to 100 years from now
    const lifetimeEnd = new Date();
    lifetimeEnd.setFullYear(lifetimeEnd.getFullYear() + 100);

    await pool.execute(
      `
      INSERT INTO subscriptions (id, user_id, subscription_status, pro_period_end_at, created_at, updated_at)
      VALUES (UUID(), ?, 'ACTIVE', ?, NOW(6), NOW(6))
      ON DUPLICATE KEY UPDATE
        subscription_status = 'ACTIVE',
        pro_period_end_at = ?,
        updated_at = NOW(6)
      `,
      [validUserId, lifetimeEnd, lifetimeEnd]
    );

    logAdminAction({
      action: "USER_ENABLE",
      adminEmail: session.user?.email ?? "Unknown",
      targetUserId: validUserId,
      details: "Granted Lifetime PRO access",
    });

    revalidatePath(`/admin/users/${validUserId}`);
    return { success: true, message: "Granted Lifetime PRO access" };
  } catch (error: any) {
    console.error("[grantLifetime] Error:", error);
    return { success: false, message: "Failed to grant lifetime access", error: "Failed to grant lifetime access" };
  }
}

export async function revokeAccess(userId: string) {
  const session = await requireAdmin();
  const validUserId = validateUserId(userId);

  try {
    await pool.execute(
      `
      UPDATE subscriptions
      SET subscription_status = 'EXPIRED',
          updated_at = NOW(6)
      WHERE user_id = ?
      `,
      [validUserId]
    );

    logAdminAction({
      action: "USER_DISABLE",
      adminEmail: session.user?.email ?? "Unknown",
      targetUserId: validUserId,
      details: "Revoked billing access (EXPIRED)",
    });

    revalidatePath(`/admin/users/${validUserId}`);
    return { success: true, message: "Billing access revoked" };
  } catch (error: any) {
    console.error("[revokeAccess] Error:", error);
    return { success: false, message: "Failed to revoke access", error: "Failed to revoke access" };
  }
}
