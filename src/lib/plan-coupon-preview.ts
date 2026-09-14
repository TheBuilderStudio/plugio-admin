import { PLAN_CATALOG_USD, formatUsd, type AdminPlanCatalog } from "@/constants";

export const MIN_PAID_CENTS = 50;
export const MIN_PERCENT_OFF = 1;
export const MAX_PERCENT_OFF = 90;

export const PERCENT_RANGE_HINT =
  `Enter a percent from ${MIN_PERCENT_OFF} to ${MAX_PERCENT_OFF}. Maximum ${MAX_PERCENT_OFF}%. 100% is not allowed.`;

export const PERCENT_INVALID_MESSAGE =
  `Percent off must be an integer from ${MIN_PERCENT_OFF} to ${MAX_PERCENT_OFF}. Maximum ${MAX_PERCENT_OFF}%. 100% is not allowed.`;

export type PercentWarningLevel = "none" | "caution" | "strong" | "danger";

export type PercentWarning = {
  level: PercentWarningLevel;
  message: string;
};

const TERM_LABELS = [
  { key: "monthly" as const, label: "monthly" },
  { key: "twoMonths" as const, label: "2 months" },
  { key: "threeMonths" as const, label: "3 months" },
];

export function isValidCouponPercent(percentOff: number): boolean {
  return Number.isInteger(percentOff) && percentOff >= MIN_PERCENT_OFF && percentOff <= MAX_PERCENT_OFF;
}

/** Same rounding as backend BillingPlanConfig.payableCentsAfterPercent. */
export function payableCentsAfterPercent(listCents: number, percentOff: number): number | null {
  if (!isValidCouponPercent(percentOff)) return null;
  if (!Number.isInteger(listCents) || listCents < MIN_PAID_CENTS) return null;
  const payable = Math.round((listCents * (100 - percentOff)) / 100);
  if (payable < MIN_PAID_CENTS) return null;
  return payable;
}

export function percentWarning(percentOff: number): PercentWarning {
  if (!isValidCouponPercent(percentOff)) {
    return { level: "none", message: "" };
  }
  if (percentOff >= MAX_PERCENT_OFF) {
    return {
      level: "danger",
      message: `Maximum ${MAX_PERCENT_OFF}% off. Checkout still pays through Razorpay.`,
    };
  }
  if (percentOff >= 50) {
    return {
      level: "strong",
      message: "This is a large cut vs list.",
    };
  }
  if (percentOff >= 25) {
    return {
      level: "caution",
      message: "Real discount — confirm this is the intended cut.",
    };
  }
  return { level: "none", message: "" };
}

export function planPricePreviewLines(
  plan: "CREATOR" | "PRO",
  percentOff: number,
  catalog: AdminPlanCatalog = PLAN_CATALOG_USD
): string[] {
  if (!isValidCouponPercent(percentOff)) return [];
  const prices = catalog[plan];
  const planLabel = plan === "PRO" ? "Pro" : "Creator";
  return TERM_LABELS.map(({ key, label }) => {
    const listCents = Math.round(prices[key] * 100);
    const payable = payableCentsAfterPercent(listCents, percentOff);
    if (payable == null) {
      return `${planLabel} · ${label}  ${formatUsd(prices[key])} → below $0.50 (cannot apply)`;
    }
    return `${planLabel} · ${label}  ${formatUsd(prices[key])} → ${formatUsd(payable / 100)}`;
  });
}

export function trialPricePreviewLine(
  percentOff: number,
  catalog: AdminPlanCatalog = PLAN_CATALOG_USD
): string {
  if (!isValidCouponPercent(percentOff)) return "";
  const listCents = Math.round(catalog.trialPrice * 100);
  const payable = payableCentsAfterPercent(listCents, percentOff);
  if (payable == null) {
    return `Trial · ${catalog.trialDays} days  ${formatUsd(catalog.trialPrice)} → below $0.50 (cannot apply)`;
  }
  return `Trial · ${catalog.trialDays} days  ${formatUsd(catalog.trialPrice)} → ${formatUsd(payable / 100)}`;
}
