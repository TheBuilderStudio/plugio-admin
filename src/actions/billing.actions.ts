"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/security";
import { pool } from "@/lib/db";
import { logAdminAction } from "@/lib/logger";

export async function grantTrial(userId: string, days: number = 14) {
  const session = await requireAdmin();

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
      [userId, trialEndsAt, trialEndsAt]
    );

    logAdminAction({
      action: "BETA_APPROVE", // Reuse or add BILLING_UPDATE
      adminEmail: session.user?.email || "Unknown",
      targetUserId: userId,
      details: `Granted ${days} day trial`,
    });

    revalidatePath(`/admin/users/${userId}`);
    return { success: true, message: `Granted ${days} day trial` };
  } catch (error: any) {
    console.error("grantTrial error:", error);
    return { success: false, error: "Failed to grant trial" };
  }
}

export async function grantLifetime(userId: string) {
  const session = await requireAdmin();

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
      [userId, lifetimeEnd, lifetimeEnd]
    );

    logAdminAction({
      action: "USER_ENABLE",
      adminEmail: session.user?.email || "Unknown",
      targetUserId: userId,
      details: `Granted Lifetime PRO`,
    });

    revalidatePath(`/admin/users/${userId}`);
    return { success: true, message: "Granted Lifetime Access" };
  } catch (error: any) {
    console.error("grantLifetime error:", error);
    return { success: false, error: "Failed to grant lifetime access" };
  }
}

export async function revokeAccess(userId: string) {
  const session = await requireAdmin();

  try {
    await pool.execute(
      `
      UPDATE subscriptions
      SET subscription_status = 'EXPIRED',
          updated_at = NOW(6)
      WHERE user_id = ?
      `,
      [userId]
    );

    logAdminAction({
      action: "USER_DISABLE",
      adminEmail: session.user?.email || "Unknown",
      targetUserId: userId,
      details: `Revoked billing access (EXPIRED)`,
    });

    revalidatePath(`/admin/users/${userId}`);
    return { success: true, message: "Revoked access" };
  } catch (error: any) {
    console.error("revokeAccess error:", error);
    return { success: false, error: "Failed to revoke access" };
  }
}
