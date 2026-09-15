import type { TrialCouponRow } from "@/types";
import {
  PLAN_CATALOG_INR,
  PLAN_CATALOG_USD,
  channelsLine,
  formatInr,
  formatUsd,
  type AdminPlanCatalog,
} from "@/constants";

export function couponHasRemaining(coupon: TrialCouponRow): boolean {
  if (!coupon.active) return false;
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= Date.now()) return false;
  if (coupon.max_redemptions == null) return true;
  return coupon.redeemed_count < coupon.max_redemptions;
}

export function pickSuggestedTrialCoupon(
  coupons: TrialCouponRow[]
): TrialCouponRow | null {
  return coupons.find(couponHasRemaining) ?? null;
}

export function buildCreatorOutreachScript(options: {
  name: string | null;
  couponCode: string | null;
  catalog?: AdminPlanCatalog;
}): string {
  const catalog = options.catalog ?? PLAN_CATALOG_USD;
  const first = options.name?.trim().split(/\s+/)[0] || "there";
  const channels = channelsLine(catalog.channelsPerPlatform.TRIAL);
  const creator2mUsd = formatUsd(catalog.CREATOR.twoMonths);
  const creator2mInr = formatInr((catalog.inr ?? PLAN_CATALOG_INR).CREATOR.twoMonths);
  const creator2m = `${creator2mUsd} / ${creator2mInr}`;
  const trialDays = catalog.trialDays;

  if (!options.couponCode) {
    return [
      `Hi ${first} — you're in Plugio beta.`,
      "",
      "I don't have an unused trial coupon ready in Coupons right now. I'll send a code from there, then:",
      "",
      "1. Sign in at plugio.app",
      `2. Enter the coupon on billing and pay through Razorpay (${trialDays}-day Creator trial — ${channels})`,
      "3. Connect one channel",
      "4. Publish or schedule one post — usually ~20 minutes",
      "",
      "Reply here if anything blocks you.",
    ].join("\n");
  }

  return [
    `Hi ${first} — you're in Plugio beta.`,
    "",
    `Your trial coupon: ${options.couponCode}`,
    "",
    "1. Sign in at plugio.app",
    `2. Enter the coupon on billing and pay through Razorpay (starts a ${trialDays}-day Creator trial — ${channels})`,
    "3. Connect one channel",
    "4. Publish or schedule one post",
    "",
    `That loop is about 20 minutes. After that you'll see why people keep Creator (${creator2m} for 2 months, prepaid — no auto-renew).`,
    "",
    "Tag @plugio.app if you post a Story or Reel. Reply here if you get stuck.",
  ].join("\n");
}
