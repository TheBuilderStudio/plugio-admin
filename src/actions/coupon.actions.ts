"use server";

/**
 * Plugio Admin — Trial Coupon Server Actions
 */

import { revalidatePath } from "next/cache";
import { requireWritableAdmin } from "@/lib/security";
import { validateCouponCode, ValidationError } from "@/lib/validation";
import {
  createPlanCoupon,
  createTrialCoupon,
  listPlanCoupons,
  listTrialCoupons,
  setPlanCouponActive,
  setTrialCouponActive,
  updatePlanCoupon,
  updateTrialCoupon,
} from "@/lib/db/queries";
import { logAdminAction } from "@/lib/logger";
import { invalidateAdminOverview } from "@/lib/db/admin-overview";
import { PERCENT_INVALID_MESSAGE, isValidCouponPercent } from "@/lib/plan-coupon-preview";
import { parseRequiredExpiry } from "@/lib/coupon-expiry";
import type { ActionResult } from "@/types";

function parsePercentOff(raw: number): { ok: true; value: number } | { ok: false; message: string } {
  const percentOff = Number(raw);
  if (!isValidCouponPercent(percentOff)) {
    return { ok: false, message: PERCENT_INVALID_MESSAGE };
  }
  return { ok: true, value: percentOff };
}

function isAuthError(message: string): boolean {
  return message.startsWith("UNAUTHORIZED") || message.startsWith("FORBIDDEN");
}

function revalidateCouponViews() {
  revalidatePath("/admin/coupons");
  revalidatePath("/admin/dashboard");
  invalidateAdminOverview();
}

function handleActionError(
  error: unknown,
  fallback: string
): ActionResult {
  const message =
    error instanceof Error ? error.message : "Unknown error occurred";

  if (isAuthError(message)) {
    return { success: false, message: "Access denied", error: "UNAUTHORIZED" };
  }
  if (error instanceof ValidationError) {
    return { success: false, message, error: "VALIDATION_ERROR" };
  }
  if (
    (error as { code?: string })?.code === "DUPLICATE" ||
    message.toLowerCase().includes("already exists")
  ) {
    return { success: false, message, error: "DUPLICATE" };
  }

  console.error("[coupon.actions]", error);
  return { success: false, message: fallback, error: "SERVER_ERROR" };
}

export async function createCouponAction(input: {
  code: string;
  maxRedemptions?: number | null;
  percentOff: number;
  expiresAt: string;
  note?: string | null;
}): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();
    const code = validateCouponCode(input.code);

    let maxRedemptions: number | null = null;
    if (
      input.maxRedemptions !== undefined &&
      input.maxRedemptions !== null &&
      String(input.maxRedemptions) !== ""
    ) {
      const n = Number(input.maxRedemptions);
      if (!Number.isInteger(n) || n < 1) {
        return {
          success: false,
          message: "Max redemptions must be a positive integer or empty (unlimited)",
          error: "VALIDATION_ERROR",
        };
      }
      maxRedemptions = n;
    }

    const percent = parsePercentOff(input.percentOff);
    if (!percent.ok) {
      return {
        success: false,
        message: percent.message,
        error: "VALIDATION_ERROR",
      };
    }
    const percentOff = percent.value;
    const expiresAt = parseRequiredExpiry(input.expiresAt);
    if (!expiresAt) {
      return {
        success: false,
        message: "Expiry is required and must be in the future",
        error: "VALIDATION_ERROR",
      };
    }

    const note =
      typeof input.note === "string" && input.note.trim()
        ? input.note.trim().slice(0, 255)
        : null;

    await createTrialCoupon({
      code,
      maxRedemptions,
      percentOff,
      expiresAt,
      note,
      createdBy: session.user?.email ?? "unknown",
    });

    logAdminAction({
      action: "COUPON_CREATE",
      adminEmail: session.user?.email!,
      details: `Created coupon ${code} (${percentOff}% off)${maxRedemptions ? ` (max ${maxRedemptions})` : " (unlimited)"}`,
    });

    revalidateCouponViews();

    return { success: true, message: `Coupon ${code} created` };
  } catch (error) {
    return handleActionError(error, "Failed to create coupon. Please try again.");
  }
}

export async function updateCouponAction(input: {
  id: string;
  maxRedemptions?: number | null;
  note?: string | null;
  active?: boolean;
  percentOff?: number;
  expiresAt?: string;
}): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();

    if (typeof input.id !== "string" || !input.id.trim()) {
      return {
        success: false,
        message: "Coupon ID is required",
        error: "VALIDATION_ERROR",
      };
    }

    const updates: {
      maxRedemptions?: number | null;
      note?: string | null;
      active?: boolean;
      percentOff?: number;
      expiresAt?: Date;
    } = {};

    if (input.maxRedemptions !== undefined) {
      if (input.maxRedemptions === null || String(input.maxRedemptions) === "") {
        updates.maxRedemptions = null;
      } else {
        const n = Number(input.maxRedemptions);
        if (!Number.isInteger(n) || n < 1) {
          return {
            success: false,
            message: "Max redemptions must be a positive integer or empty (unlimited)",
            error: "VALIDATION_ERROR",
          };
        }
        updates.maxRedemptions = n;
      }
    }

    if (updates.maxRedemptions != null) {
      const coupons = await listTrialCoupons();
      const current = coupons.find((c) => c.id === input.id.trim());
      if (current && updates.maxRedemptions < current.redeemed_count) {
        return {
          success: false,
          message: `Max redemptions cannot be below current usage (${current.redeemed_count})`,
          error: "VALIDATION_ERROR",
        };
      }
    }

    if (input.note !== undefined) {
      updates.note =
        typeof input.note === "string" && input.note.trim()
          ? input.note.trim().slice(0, 255)
          : null;
    }

    if (input.active !== undefined) {
      updates.active = Boolean(input.active);
    }
    if (input.percentOff !== undefined) {
      const percent = parsePercentOff(input.percentOff);
      if (!percent.ok) {
        return {
          success: false,
          message: percent.message,
          error: "VALIDATION_ERROR",
        };
      }
      updates.percentOff = percent.value;
    }
    if (input.expiresAt !== undefined) {
      const expiresAt = parseRequiredExpiry(input.expiresAt);
      if (!expiresAt) {
        return {
          success: false,
          message: "Expiry is required and must be in the future",
          error: "VALIDATION_ERROR",
        };
      }
      updates.expiresAt = expiresAt;
    }

    const affected = await updateTrialCoupon(input.id.trim(), updates);
    if (affected === 0) {
      return {
        success: false,
        message: "Coupon not found",
        error: "NOT_FOUND",
      };
    }

    logAdminAction({
      action: "COUPON_UPDATE",
      adminEmail: session.user?.email!,
      details: `Updated coupon ${input.id}: ${JSON.stringify(updates)}`,
    });

    revalidateCouponViews();

    return { success: true, message: "Coupon updated" };
  } catch (error) {
    return handleActionError(error, "Failed to update coupon. Please try again.");
  }
}

function parseMaxRedemptions(raw: number | null | undefined): {
  ok: true;
  value: number | null;
} | {
  ok: false;
  message: string;
} {
  if (raw === undefined || raw === null || String(raw) === "") {
    return { ok: true, value: null };
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    return {
      ok: false,
      message: "Max redemptions must be a positive integer or empty (unlimited)",
    };
  }
  return { ok: true, value: n };
}

export async function createPlanCouponAction(input: {
  code: string;
  plan: "CREATOR" | "PRO";
  percentOff: number;
  maxRedemptions?: number | null;
  expiresAt: string;
  note?: string | null;
}): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();
    const code = validateCouponCode(input.code);
    if (input.plan !== "CREATOR" && input.plan !== "PRO") {
      return {
        success: false,
        message: "Plan must be Creator or Pro",
        error: "VALIDATION_ERROR",
      };
    }
    const percent = parsePercentOff(input.percentOff);
    if (!percent.ok) {
      return {
        success: false,
        message: percent.message,
        error: "VALIDATION_ERROR",
      };
    }
    const percentOff = percent.value;
    const expiresAt = parseRequiredExpiry(input.expiresAt);
    if (!expiresAt) {
      return {
        success: false,
        message: "Expiry is required and must be in the future",
        error: "VALIDATION_ERROR",
      };
    }
    const max = parseMaxRedemptions(input.maxRedemptions);
    if (!max.ok) {
      return { success: false, message: max.message, error: "VALIDATION_ERROR" };
    }
    const note =
      typeof input.note === "string" && input.note.trim()
        ? input.note.trim().slice(0, 255)
        : null;

    await createPlanCoupon({
      code,
      plan: input.plan,
      percentOff,
      maxRedemptions: max.value,
      expiresAt,
      note,
      createdBy: session.user?.email ?? "unknown",
    });

    logAdminAction({
      action: "PLAN_COUPON_CREATE",
      adminEmail: session.user?.email!,
      details: `Created ${input.plan} coupon ${code} (${percentOff}% off)`,
    });

    revalidateCouponViews();
    return { success: true, message: `Coupon ${code} created` };
  } catch (error) {
    return handleActionError(error, "Failed to create plan coupon. Please try again.");
  }
}

export async function updatePlanCouponAction(input: {
  id: string;
  maxRedemptions?: number | null;
  note?: string | null;
  active?: boolean;
  expiresAt?: string;
  percentOff?: number;
}): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();
    if (typeof input.id !== "string" || !input.id.trim()) {
      return {
        success: false,
        message: "Coupon ID is required",
        error: "VALIDATION_ERROR",
      };
    }

    const updates: {
      maxRedemptions?: number | null;
      note?: string | null;
      active?: boolean;
      expiresAt?: Date;
      percentOff?: number;
    } = {};

    if (input.maxRedemptions !== undefined) {
      const max = parseMaxRedemptions(input.maxRedemptions);
      if (!max.ok) {
        return { success: false, message: max.message, error: "VALIDATION_ERROR" };
      }
      updates.maxRedemptions = max.value;
    }

    if (updates.maxRedemptions != null) {
      const coupons = await listPlanCoupons();
      const current = coupons.find((c) => c.id === input.id.trim());
      if (current && updates.maxRedemptions < current.redeemed_count) {
        return {
          success: false,
          message: `Max redemptions cannot be below current usage (${current.redeemed_count})`,
          error: "VALIDATION_ERROR",
        };
      }
    }

    if (input.note !== undefined) {
      updates.note =
        typeof input.note === "string" && input.note.trim()
          ? input.note.trim().slice(0, 255)
          : null;
    }
    if (input.active !== undefined) {
      updates.active = Boolean(input.active);
    }
    if (input.expiresAt !== undefined) {
      const expiresAt = parseRequiredExpiry(input.expiresAt);
      if (!expiresAt) {
        return {
          success: false,
          message: "Expiry is required and must be in the future",
          error: "VALIDATION_ERROR",
        };
      }
      updates.expiresAt = expiresAt;
    }
    if (input.percentOff !== undefined) {
      const percent = parsePercentOff(input.percentOff);
      if (!percent.ok) {
        return {
          success: false,
          message: percent.message,
          error: "VALIDATION_ERROR",
        };
      }
      updates.percentOff = percent.value;
    }

    const affected = await updatePlanCoupon(input.id.trim(), updates);
    if (affected === 0) {
      return {
        success: false,
        message: "Coupon not found",
        error: "NOT_FOUND",
      };
    }

    logAdminAction({
      action: "PLAN_COUPON_UPDATE",
      adminEmail: session.user?.email!,
      details: `Updated plan coupon ${input.id}: ${JSON.stringify({
        ...updates,
        expiresAt: updates.expiresAt?.toISOString(),
      })}`,
    });

    revalidateCouponViews();
    return { success: true, message: "Coupon updated" };
  } catch (error) {
    return handleActionError(error, "Failed to update plan coupon. Please try again.");
  }
}

export async function setPlanCouponActiveAction(
  id: string,
  active: boolean
): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();
    if (typeof id !== "string" || !id.trim()) {
      return {
        success: false,
        message: "Coupon ID is required",
        error: "VALIDATION_ERROR",
      };
    }
    const affected = await setPlanCouponActive(id.trim(), active);
    if (affected === 0) {
      return {
        success: false,
        message: "Coupon not found",
        error: "NOT_FOUND",
      };
    }
    logAdminAction({
      action: active ? "PLAN_COUPON_ACTIVATE" : "PLAN_COUPON_DEACTIVATE",
      adminEmail: session.user?.email!,
      details: `${active ? "Activated" : "Deactivated"} plan coupon ${id}`,
    });
    revalidateCouponViews();
    return {
      success: true,
      message: active ? "Coupon activated" : "Coupon deactivated",
    };
  } catch (error) {
    return handleActionError(
      error,
      "Failed to update coupon status. Please try again."
    );
  }
}

export async function setCouponActiveAction(
  id: string,
  active: boolean
): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();

    if (typeof id !== "string" || !id.trim()) {
      return {
        success: false,
        message: "Coupon ID is required",
        error: "VALIDATION_ERROR",
      };
    }

    const affected = await setTrialCouponActive(id.trim(), active);
    if (affected === 0) {
      return {
        success: false,
        message: "Coupon not found",
        error: "NOT_FOUND",
      };
    }

    logAdminAction({
      action: active ? "COUPON_ACTIVATE" : "COUPON_DEACTIVATE",
      adminEmail: session.user?.email!,
      details: `${active ? "Activated" : "Deactivated"} coupon ${id}`,
    });

    revalidateCouponViews();

    return {
      success: true,
      message: active ? "Coupon activated" : "Coupon deactivated",
    };
  } catch (error) {
    return handleActionError(
      error,
      "Failed to update coupon status. Please try again."
    );
  }
}

