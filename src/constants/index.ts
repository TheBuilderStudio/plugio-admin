/**
 * Plugio Admin — Constants
 *
 * This is the single source of truth for all admin configuration.
 * Admin emails are the only users allowed to access this panel.
 * To add or remove admins, update this array and redeploy.
 */

export const ADMIN_EMAILS: string[] = [
  "manavhustles@gmail.com",
  "427rohitkumar@gmail.com",
  "admin@plugio.app",
];

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
