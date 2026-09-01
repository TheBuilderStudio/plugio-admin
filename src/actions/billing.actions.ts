"use server";

/**
 * Plugio Admin — Billing / Complimentary Access Server Actions
 *
 * Complimentary grants overlay paid/trial access. They never create fake
 * payments and never force-expire paid subscriptions.
 */

import { revalidatePath } from "next/cache";
import { requireWritableAdmin, requireControlReason } from "@/lib/security";
import {
  validateUserId,
  validateGrantPlan,
  validateGrantDuration,
  ValidationError,
} from "@/lib/validation";
import {
  getActiveGrantForUser,
  getSubscriptionSnapshotForUser,
  getUserEmailById,
  replaceAdminGrantAtomic,
  revokeAdminGrant,
  updateAdminGrant,
} from "@/lib/db/queries";
import { logAdminAction } from "@/lib/logger";
import { invalidateAdminOverview } from "@/lib/db/admin-overview";
import type { ActionResult, GrantPlanId, PlanIdValue } from "@/types";

function isAuthError(message: string): boolean {
  return message.startsWith("UNAUTHORIZED") || message.startsWith("FORBIDDEN");
}

function handleActionError(error: unknown, fallback: string): ActionResult {
  const message =
    error instanceof Error ? error.message : "Unknown error occurred";

  if (isAuthError(message)) {
    return { success: false, message: "Access denied", error: "UNAUTHORIZED" };
  }
  if (message.startsWith("VALIDATION:")) {
    return {
      success: false,
      message: message.replace(/^VALIDATION:\s*/, ""),
      error: "VALIDATION",
    };
  }
  if (error instanceof ValidationError) {
    return { success: false, message, error: "VALIDATION_ERROR" };
  }

  console.error("[billing.actions]", error);
  return { success: false, message: fallback, error: "SERVER_ERROR" };
}

function revalidateUser(userId: string) {
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin/dashboard");
  invalidateAdminOverview();
}

function addDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function isActivePaidPro(sub: {
  subscription_status: string | null;
  plan_id: PlanIdValue | null;
  pro_period_end_at: Date | null;
}): boolean {
  if (sub.subscription_status !== "ACTIVE") return false;
  if (sub.plan_id !== "PRO") return false;
  if (!sub.pro_period_end_at) return false;
  return sub.pro_period_end_at.getTime() > Date.now();
}

function snapshotPreviousPlan(sub: {
  subscription_status: string | null;
  plan_id: PlanIdValue | null;
} | null): PlanIdValue | null {
  if (!sub?.plan_id) return null;
  return sub.plan_id;
}

function totalDurationDays(startsAt: Date, endsAt: Date): number {
  const ms = endsAt.getTime() - startsAt.getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

/**
 * Revoke complimentary access only.
 * Does NOT expire paid/trial subscriptions.
 */
export async function revokeAccess(
  userId: string,
  reason?: string | null
): Promise<ActionResult> {
  return revokeComplimentaryAccessAction(userId, reason);
}

export async function revokeComplimentaryAccessAction(
  userId: string,
  reason?: string | null
): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();
    const validUserId = validateUserId(userId);
    const controlReason = requireControlReason(reason, "Revoke reason");
    const targetUser = await getUserEmailById(validUserId);
    if (!targetUser) {
      return { success: false, message: "User not found", error: "NOT_FOUND" };
    }

    const activeGrant = await getActiveGrantForUser(validUserId);
    if (!activeGrant) {
      return {
        success: false,
        message:
          "No active complimentary grant to revoke. Paid or trial subscription access must not be destroyed from this action.",
        error: "NO_ACTIVE_GRANT",
      };
    }

    const adminEmail = session.user?.email ?? "unknown";
    await revokeAdminGrant(activeGrant.id, adminEmail);

    logAdminAction({
      action: "BILLING_GRANT_REVOKE",
      adminEmail,
      targetUserId: validUserId,
      targetEmail: targetUser.email,
      details: `Revoked complimentary ${activeGrant.plan_id} grant (${activeGrant.id}). Reason: ${controlReason}`,
    });

    revalidateUser(validUserId);

    return {
      success: true,
      message: `Complimentary ${activeGrant.plan_id} access revoked`,
    };
  } catch (error) {
    return handleActionError(
      error,
      "Failed to revoke complimentary access. Please try again."
    );
  }
}

export async function grantComplimentaryAccessAction(input: {
  userId: string;
  planId: GrantPlanId;
  durationDays: 30 | 60 | 90;
  reason?: string | null;
  notes?: string | null;
}): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();
    const validUserId = validateUserId(input.userId);
    const planId = validateGrantPlan(input.planId);
    const durationDays = validateGrantDuration(input.durationDays);

    const targetUser = await getUserEmailById(validUserId);
    if (!targetUser) {
      return { success: false, message: "User not found", error: "NOT_FOUND" };
    }

    const sub = await getSubscriptionSnapshotForUser(validUserId);
    if (sub && isActivePaidPro(sub) && planId === "CREATOR") {
      return {
        success: false,
        message:
          "Cannot grant CREATOR over an active paid PRO subscription (no downgrade overlay).",
        error: "DOWNGRADE_BLOCKED",
      };
    }

    const adminEmail = session.user?.email ?? "unknown";
    const reason = requireControlReason(input.reason);
    const notes =
      typeof input.notes === "string" && input.notes.trim()
        ? input.notes.trim().slice(0, 1000)
        : null;

    const existing = await getActiveGrantForUser(validUserId);
    const now = new Date();
    const endsAt = addDays(now, durationDays);
    const previousEffectivePlan = existing
      ? existing.plan_id
      : snapshotPreviousPlan(sub);

    const { revokedCount } = await replaceAdminGrantAtomic({
      userId: validUserId,
      planId,
      startsAt: now,
      endsAt,
      durationDays,
      reason,
      notes,
      grantedByAdminEmail: adminEmail,
      previousEffectivePlan,
    });

    logAdminAction({
      action: revokedCount > 0 ? "BILLING_GRANT_CHANGE" : "BILLING_GRANT",
      adminEmail,
      targetUserId: validUserId,
      targetEmail: targetUser.email,
      details:
        revokedCount > 0
          ? `Replaced ${revokedCount} grant(s) → complimentary ${planId} for ${durationDays} days`
          : `Granted complimentary ${planId} for ${durationDays} days`,
    });

    revalidateUser(validUserId);

    return {
      success: true,
      message: `Complimentary ${planId} access granted for ${durationDays} days`,
    };
  } catch (error) {
    return handleActionError(
      error,
      "Failed to grant complimentary access. Please try again."
    );
  }
}

export async function extendComplimentaryAccessAction(input: {
  userId: string;
  extraDays: 30 | 60 | 90;
  reason?: string | null;
  notes?: string | null;
}): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();
    const validUserId = validateUserId(input.userId);
    const extraDays = validateGrantDuration(input.extraDays);

    const targetUser = await getUserEmailById(validUserId);
    if (!targetUser) {
      return { success: false, message: "User not found", error: "NOT_FOUND" };
    }

    const activeGrant = await getActiveGrantForUser(validUserId);
    if (!activeGrant) {
      return {
        success: false,
        message: "No active complimentary grant to extend. Grant access first.",
        error: "NO_ACTIVE_GRANT",
      };
    }

    const sub = await getSubscriptionSnapshotForUser(validUserId);
    if (sub && isActivePaidPro(sub) && activeGrant.plan_id === "CREATOR") {
      return {
        success: false,
        message:
          "Cannot extend a CREATOR grant while user has an active paid PRO subscription. Change to PRO first.",
        error: "DOWNGRADE_BLOCKED",
      };
    }

    const newEndsAt = addDays(activeGrant.ends_at, extraDays);
    const durationDays = totalDurationDays(activeGrant.starts_at, newEndsAt);
    const reason = requireControlReason(
      input.reason?.trim() ? input.reason : activeGrant.reason
    );
    const notes =
      typeof input.notes === "string" && input.notes.trim()
        ? input.notes.trim().slice(0, 1000)
        : activeGrant.notes;

    const affected = await updateAdminGrant(activeGrant.id, {
      endsAt: newEndsAt,
      durationDays,
      reason,
      notes,
    });
    if (affected === 0) {
      return {
        success: false,
        message: "Grant not found",
        error: "NOT_FOUND",
      };
    }

    logAdminAction({
      action: "BILLING_GRANT_EXTEND",
      adminEmail: session.user?.email!,
      targetUserId: validUserId,
      targetEmail: targetUser.email,
      details: `Extended ${activeGrant.plan_id} grant by ${extraDays} days → ${newEndsAt.toISOString()}`,
    });

    revalidateUser(validUserId);

    return {
      success: true,
      message: `Complimentary access extended by ${extraDays} days`,
    };
  } catch (error) {
    return handleActionError(
      error,
      "Failed to extend complimentary access. Please try again."
    );
  }
}

export async function changeComplimentaryPlanAction(input: {
  userId: string;
  planId: GrantPlanId;
  reason?: string | null;
  notes?: string | null;
}): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();
    const validUserId = validateUserId(input.userId);
    const planId = validateGrantPlan(input.planId);

    const targetUser = await getUserEmailById(validUserId);
    if (!targetUser) {
      return { success: false, message: "User not found", error: "NOT_FOUND" };
    }

    const activeGrant = await getActiveGrantForUser(validUserId);
    if (!activeGrant) {
      return {
        success: false,
        message: "No active complimentary grant to change. Grant access first.",
        error: "NO_ACTIVE_GRANT",
      };
    }

    if (activeGrant.plan_id === planId) {
      return {
        success: false,
        message: `Grant is already on ${planId}`,
        error: "NO_CHANGE",
      };
    }

    const sub = await getSubscriptionSnapshotForUser(validUserId);
    if (sub && isActivePaidPro(sub) && planId === "CREATOR") {
      return {
        success: false,
        message:
          "Cannot change to CREATOR while user has an active paid PRO subscription.",
        error: "DOWNGRADE_BLOCKED",
      };
    }

    const reason = requireControlReason(
      input.reason?.trim() ? input.reason : activeGrant.reason
    );
    const notes =
      typeof input.notes === "string" && input.notes.trim()
        ? input.notes.trim().slice(0, 1000)
        : activeGrant.notes;

    const affected = await updateAdminGrant(activeGrant.id, {
      planId,
      reason,
      notes,
    });
    if (affected === 0) {
      return {
        success: false,
        message: "Grant not found",
        error: "NOT_FOUND",
      };
    }

    logAdminAction({
      action: "BILLING_GRANT_CHANGE",
      adminEmail: session.user?.email!,
      targetUserId: validUserId,
      targetEmail: targetUser.email,
      details: `Changed complimentary plan ${activeGrant.plan_id} → ${planId}`,
    });

    revalidateUser(validUserId);

    return {
      success: true,
      message: `Complimentary plan changed to ${planId}`,
    };
  } catch (error) {
    return handleActionError(
      error,
      "Failed to change complimentary plan. Please try again."
    );
  }
}
