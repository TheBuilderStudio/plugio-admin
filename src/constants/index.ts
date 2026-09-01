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

/**
 * Paid catalog — mirrors backend BillingPlanConfig (USD).
 * Used for overview revenue / MRR estimates and pricing display.
 */
export const PLAN_CATALOG_USD = {
  currency: "USD",
  trialDays: 7,
  trialPrice: 0,
  CREATOR: { monthly: 9, twoMonths: 16, threeMonths: 21 },
  PRO: { monthly: 15, twoMonths: 28, threeMonths: 39 },
  channelsPerPlatform: { TRIAL: 1, CREATOR: 2, PRO: 3 },
} as const;

export function catalogPeriodPriceUsd(
  plan: "CREATOR" | "PRO",
  interval: string | null | undefined
): number {
  const prices = PLAN_CATALOG_USD[plan];
  const key = (interval ?? "MONTHLY").toUpperCase();
  if (key === "TWO_MONTH" || key === "TWO_MONTHS") return prices.twoMonths;
  if (key === "THREE_MONTH" || key === "THREE_MONTHS") return prices.threeMonths;
  if (key === "YEARLY") return prices.monthly * 12;
  return prices.monthly;
}

/** Normalize a prepaid period price into approximate monthly revenue. */
export function toMonthlyUsd(
  plan: "CREATOR" | "PRO",
  interval: string | null | undefined
): number {
  const periodPrice = catalogPeriodPriceUsd(plan, interval);
  const key = (interval ?? "MONTHLY").toUpperCase();
  if (key === "TWO_MONTH" || key === "TWO_MONTHS") return periodPrice / 2;
  if (key === "THREE_MONTH" || key === "THREE_MONTHS") return periodPrice / 3;
  if (key === "YEARLY") return periodPrice / 12;
  return periodPrice;
}

export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) return "$0";
  const rounded = Math.round(amount * 100) / 100;
  const hasCents = Math.round(rounded * 100) % 100 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rounded);
}
