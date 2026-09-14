"use server";

import { revalidatePath } from "next/cache";
import { requireWritableAdmin } from "@/lib/security";
import { ValidationError } from "@/lib/validation";
import { updateBillingPlanSettings } from "@/lib/db/queries";
import { logAdminAction } from "@/lib/logger";
import { invalidateAdminOverview } from "@/lib/db/admin-overview";
import { type AdminPlanCatalog } from "@/constants";
import { MIN_PAID_CENTS } from "@/lib/plan-coupon-preview";
import type { ActionResult } from "@/types";

const MIN_CHANNELS = 1;
const MAX_CHANNELS = 10;
const MIN_TRIAL_DAYS = 1;
const MAX_TRIAL_DAYS = 30;

function isAuthError(message: string): boolean {
  return message.startsWith("UNAUTHORIZED") || message.startsWith("FORBIDDEN");
}

function parseUsd(raw: unknown, label: string): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    throw new ValidationError(`${label} must be a number.`);
  }
  const cents = Math.round(n * 100);
  if (cents < MIN_PAID_CENTS) {
    throw new ValidationError(`${label} must be at least $0.50.`);
  }
  if (cents > 999_99) {
    throw new ValidationError(`${label} is too large.`);
  }
  return cents / 100;
}

function parseIntInRange(raw: unknown, label: string, min: number, max: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ValidationError(`${label} must be an integer from ${min} to ${max}.`);
  }
  return n;
}

export async function updatePlanCatalogAction(input: {
  trialDays: number;
  trialPrice: number;
  creatorMonthly: number;
  creatorTwoMonths: number;
  creatorThreeMonths: number;
  proMonthly: number;
  proTwoMonths: number;
  proThreeMonths: number;
  trialChannels: number;
  creatorChannels: number;
  proChannels: number;
}): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();

    const catalog: AdminPlanCatalog = {
      currency: "USD",
      trialDays: parseIntInRange(input.trialDays, "Trial days", MIN_TRIAL_DAYS, MAX_TRIAL_DAYS),
      trialPrice: parseUsd(input.trialPrice, "Trial list price"),
      CREATOR: {
        monthly: parseUsd(input.creatorMonthly, "Creator monthly"),
        twoMonths: parseUsd(input.creatorTwoMonths, "Creator 2 months"),
        threeMonths: parseUsd(input.creatorThreeMonths, "Creator 3 months"),
      },
      PRO: {
        monthly: parseUsd(input.proMonthly, "Pro monthly"),
        twoMonths: parseUsd(input.proTwoMonths, "Pro 2 months"),
        threeMonths: parseUsd(input.proThreeMonths, "Pro 3 months"),
      },
      channelsPerPlatform: {
        TRIAL: parseIntInRange(input.trialChannels, "Trial channels", MIN_CHANNELS, MAX_CHANNELS),
        CREATOR: parseIntInRange(
          input.creatorChannels,
          "Creator channels",
          MIN_CHANNELS,
          MAX_CHANNELS
        ),
        PRO: parseIntInRange(input.proChannels, "Pro channels", MIN_CHANNELS, MAX_CHANNELS),
      },
    };

    await updateBillingPlanSettings({
      catalog,
      updatedBy: session.user?.email ?? "unknown",
    });

    logAdminAction({
      action: "PLAN_CATALOG_UPDATE",
      adminEmail: session.user?.email!,
      details: `Trial $${catalog.trialPrice}/${catalog.trialDays}d · Creator $${catalog.CREATOR.monthly}/$${catalog.CREATOR.twoMonths}/$${catalog.CREATOR.threeMonths} · Pro $${catalog.PRO.monthly}/$${catalog.PRO.twoMonths}/$${catalog.PRO.threeMonths} · channels ${catalog.channelsPerPlatform.TRIAL}/${catalog.channelsPerPlatform.CREATOR}/${catalog.channelsPerPlatform.PRO}`,
    });

    revalidatePath("/admin/plans");
    revalidatePath("/admin/coupons");
    revalidatePath("/admin/dashboard");
    invalidateAdminOverview();

    return { success: true, message: "Plan prices and channel limits saved. Checkout uses them within a few seconds." };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    if (isAuthError(message)) {
      return { success: false, message: "Access denied", error: "UNAUTHORIZED" };
    }
    if (error instanceof ValidationError) {
      return { success: false, message, error: "VALIDATION_ERROR" };
    }
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : "";
    if (code === "ER_NO_SUCH_TABLE") {
      return {
        success: false,
        message: "Apply backend migration V44 (billing_plan_settings) first.",
        error: "SERVER_ERROR",
      };
    }
    console.error("[plan.actions]", error);
    return { success: false, message: "Failed to save plan catalog.", error: "SERVER_ERROR" };
  }
}
