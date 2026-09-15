import { PLAN_CATALOG_USD, formatInr, formatUsd, type AdminPlanCatalog } from "@/constants";

export const MIN_PAID_CENTS = 50;
export const MIN_PAID_PAISE = 100;
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
export function payableMinorAfterPercent(
  listMinor: number,
  percentOff: number,
  minMinor: number
): number | null {
  if (!isValidCouponPercent(percentOff)) return null;
  if (!Number.isInteger(listMinor) || listMinor < minMinor) return null;
  const payable = Math.round((listMinor * (100 - percentOff)) / 100);
  if (payable < minMinor) return null;
  return payable;
}

export function payableCentsAfterPercent(listCents: number, percentOff: number): number | null {
  return payableMinorAfterPercent(listCents, percentOff, MIN_PAID_CENTS);
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
  const usdPrices = catalog[plan];
  const inrPrices = (catalog.inr ?? PLAN_CATALOG_USD.inr)[plan];
  const planLabel = plan === "PRO" ? "Pro" : "Creator";
  const usd = TERM_LABELS.map(({ key, label }) => {
    const listCents = Math.round(usdPrices[key] * 100);
    const payable = payableMinorAfterPercent(listCents, percentOff, MIN_PAID_CENTS);
    if (payable == null) {
      return `${planLabel} · ${label}  ${formatUsd(usdPrices[key])} → below $0.50 (cannot apply)`;
    }
    return `${planLabel} · ${label}  ${formatUsd(usdPrices[key])} → ${formatUsd(payable / 100)}`;
  });
  const inr = TERM_LABELS.map(({ key, label }) => {
    const listPaise = Math.round(inrPrices[key] * 100);
    const payable = payableMinorAfterPercent(listPaise, percentOff, MIN_PAID_PAISE);
    if (payable == null) {
      return `${planLabel} · ${label}  ${formatInr(inrPrices[key])} → below ₹1 (cannot apply)`;
    }
    return `${planLabel} · ${label}  ${formatInr(inrPrices[key])} → ${formatInr(payable / 100)}`;
  });
  return [...usd, ...inr];
}

export function trialPricePreviewLine(
  percentOff: number,
  catalog: AdminPlanCatalog = PLAN_CATALOG_USD
): string {
  if (!isValidCouponPercent(percentOff)) return "";
  const listCents = Math.round(catalog.trialPrice * 100);
  const payableUsd = payableMinorAfterPercent(listCents, percentOff, MIN_PAID_CENTS);
  const usd =
    payableUsd == null
      ? `Trial · ${catalog.trialDays} days  ${formatUsd(catalog.trialPrice)} → below $0.50 (cannot apply)`
      : `Trial · ${catalog.trialDays} days  ${formatUsd(catalog.trialPrice)} → ${formatUsd(payableUsd / 100)}`;
  const inrList = (catalog.inr ?? PLAN_CATALOG_USD.inr).trialPrice;
  const listPaise = Math.round(inrList * 100);
  const payableInr = payableMinorAfterPercent(listPaise, percentOff, MIN_PAID_PAISE);
  const inr =
    payableInr == null
      ? `${formatInr(inrList)} → below ₹1 (cannot apply)`
      : `${formatInr(inrList)} → ${formatInr(payableInr / 100)}`;
  return `${usd} · ${inr}`;
}
