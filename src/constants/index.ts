/**
 * Plugio Admin — Constants
 *
 * This is the single source of truth for all admin configuration.
 * Admin emails are the only users allowed to access this panel.
 * To add or remove admins, update this array and redeploy.
 */

const defaultAdminEmails = [
  "manavhustles@gmail.com",
  "427rohitkumar@gmail.com",
  "admin@plugio.app",
];

const envAdminEmails = process.env.ADMIN_EMAILS
  ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
  : [];

export const ADMIN_EMAILS: string[] = Array.from(
  new Set([...defaultAdminEmails.map((e) => e.toLowerCase()), ...envAdminEmails])
);

export const APP_NAME = "Plugio Admin";
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0";
export const ENVIRONMENT =
  process.env.NEXT_PUBLIC_ENVIRONMENT ?? "development";

/** Rows per page for all paginated tables */
export const PAGE_SIZE = 20;

/** Maximum search query length to prevent abuse */
export const MAX_SEARCH_LENGTH = 100;

/** Beta access status values matching the plugio_db users table */
export const BetaStatus = {
  APPROVED: "APPROVED",
  PENDING: "PENDING",
  REJECTED: "REJECTED",
} as const;

/** Subscription status values matching the plugio_db subscriptions table */
export const SubscriptionStatus = {
  NONE: "NONE",
  TRIALING: "TRIALING",
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
} as const;

/** Social platform identifiers matching the plugio_db social_accounts table */
export const SocialPlatform = {
  YOUTUBE: "YOUTUBE",
  INSTAGRAM: "INSTAGRAM",
  FACEBOOK: "FACEBOOK",
} as const;

export type AdminPlanTermPrices = {
  monthly: number;
  twoMonths: number;
  threeMonths: number;
};

export type AdminInrCatalog = {
  trialPrice: number;
  CREATOR: AdminPlanTermPrices;
  PRO: AdminPlanTermPrices;
};

/**
 * Paid catalog defaults — live values live in billing_plan_settings (Admin → Plans).
 * Used as fallback when the table is missing, and for typed helpers.
 * INR list prices are explicit (rupees), not converted from USD.
 */
export type AdminPlanCatalog = {
  currency: "USD";
  trialDays: number;
  trialPrice: number;
  CREATOR: AdminPlanTermPrices;
  PRO: AdminPlanTermPrices;
  channelsPerPlatform: { TRIAL: number; CREATOR: number; PRO: number };
  inr: AdminInrCatalog;
};

export const PLAN_CATALOG_INR: AdminInrCatalog = {
  trialPrice: 599,
  CREATOR: { monthly: 1299, twoMonths: 2299, threeMonths: 3299 },
  PRO: { monthly: 1699, twoMonths: 2999, threeMonths: 4299 },
};

export const PLAN_CATALOG_USD: AdminPlanCatalog = {
  currency: "USD",
  trialDays: 7,
  trialPrice: 7,
  CREATOR: { monthly: 15, twoMonths: 27, threeMonths: 39 },
  PRO: { monthly: 20, twoMonths: 36, threeMonths: 51 },
  channelsPerPlatform: { TRIAL: 2, CREATOR: 3, PRO: 4 },
  inr: { ...PLAN_CATALOG_INR, CREATOR: { ...PLAN_CATALOG_INR.CREATOR }, PRO: { ...PLAN_CATALOG_INR.PRO } },
};

export function catalogPeriodPriceUsd(
  plan: "CREATOR" | "PRO",
  interval: string | null | undefined,
  catalog: AdminPlanCatalog = PLAN_CATALOG_USD
): number {
  const prices = catalog[plan];
  const key = (interval ?? "MONTHLY").toUpperCase();
  if (key === "TWO_MONTH" || key === "TWO_MONTHS") return prices.twoMonths;
  if (key === "THREE_MONTH" || key === "THREE_MONTHS") return prices.threeMonths;
  if (key === "YEARLY") return prices.monthly * 12;
  return prices.monthly;
}

/** Normalize a prepaid period price into approximate monthly revenue. */
export function toMonthlyUsd(
  plan: "CREATOR" | "PRO",
  interval: string | null | undefined,
  catalog: AdminPlanCatalog = PLAN_CATALOG_USD
): number {
  const periodPrice = catalogPeriodPriceUsd(plan, interval, catalog);
  const key = (interval ?? "MONTHLY").toUpperCase();
  if (key === "TWO_MONTH" || key === "TWO_MONTHS") return periodPrice / 2;
  if (key === "THREE_MONTH" || key === "THREE_MONTHS") return periodPrice / 3;
  if (key === "YEARLY") return periodPrice / 12;
  return periodPrice;
}

/** Percent saved vs paying monthly for the same length. Null when there is no cut. */
export function termSavePercent(
  monthly: number,
  termPrice: number,
  months: number
): number | null {
  if (!Number.isFinite(monthly) || !Number.isFinite(termPrice) || months < 2) return null;
  const was = monthly * months;
  if (!(was > 0) || termPrice >= was - 1e-9) return null;
  const pct = Math.round(((was - termPrice) / was) * 100);
  return pct > 0 ? pct : null;
}

export function formatUsd(amount: number): string {
  return formatMajor(amount, "USD", "en-US", "$0");
}

export function formatInr(amount: number): string {
  return formatMajor(amount, "INR", "en-IN", "₹0");
}

/** Format coupon payable minors using the order currency. Never assume USD. */
export function formatPayableMinor(
  payableCents: number | null | undefined,
  currency?: string | null
): string {
  if (payableCents == null || !Number.isFinite(payableCents)) return "—";
  const major = payableCents / 100;
  const code = (currency ?? "").trim().toUpperCase();
  if (code === "INR") return formatInr(major);
  if (code === "USD") return formatUsd(major);
  return major.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function formatMajor(
  amount: number,
  currency: "USD" | "INR",
  locale: string,
  fallback: string
): string {
  if (!Number.isFinite(amount)) return fallback;
  const rounded = Math.round(amount * 100) / 100;
  const hasFraction = Math.round(rounded * 100) % 100 !== 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rounded);
}

export function channelsLine(perPlatform: number): string {
  const n = Number.isInteger(perPlatform) ? perPlatform : 0;
  const yt = n === 1 ? "1 YouTube channel" : `${n} YouTube channels`;
  const ig = n === 1 ? "1 Instagram page" : `${n} Instagram pages`;
  const fb = n === 1 ? "1 Facebook page" : `${n} Facebook pages`;
  return `${yt} + ${ig} + ${fb}`;
}
