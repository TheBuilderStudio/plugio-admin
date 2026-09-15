/**
 * Plugio Admin — TypeScript Types
 *
 * These types mirror the plugio_db schema exactly.
 * Do not add fictional fields — only map what exists in the database.
 */

import { BetaStatus, SubscriptionStatus } from "@/constants";

// ─── Utility types ────────────────────────────────────────

export type BetaStatusValue = (typeof BetaStatus)[keyof typeof BetaStatus];
export type SubscriptionStatusValue =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];
export type Platform = "YOUTUBE" | "INSTAGRAM" | "FACEBOOK";

// ─── Database row types ───────────────────────────────────

/** Mirrors the plugio_db `users` table */
export interface DbUser {
  id: string;
  google_id: string;
  email: string;
  name: string | null;
  picture: string | null;
  bio: string | null;
  username: string | null;
  is_public: boolean;
  niche: string | null;
  tagline: string | null;
  location: string | null;
  // Beta access fields
  access_status: BetaStatusValue | null;
  beta_approved: boolean | null;
  is_whitelisted: boolean | null;
  // Social handles from beta application
  instagram_username: string | null;
  youtube_channel: string | null;
  facebook_page: string | null;
  instagram_followers: number | null;
  youtube_followers: number | null;
  facebook_followers: number | null;
  application_message: string | null;
  beta_application_submitted_at: Date | null;
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

export type PlanIdValue = "TRIAL" | "CREATOR" | "PRO";

/** Mirrors the plugio_db `subscriptions` table */
export interface DbSubscription {
  id: string;
  user_id: string;
  subscription_status: SubscriptionStatusValue;
  plan_id: PlanIdValue | null;
  plan_started_at: Date | null;
  trial_ends_at: Date | null;
  pro_period_end_at: Date | null;
  has_used_trial: boolean;
  billing_interval: "MONTHLY" | "YEARLY" | "TWO_MONTH" | "THREE_MONTH" | null;
  payment_last4: string | null;
  external_payment_id: string | null;
  external_order_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Mirrors the plugio_db `trial_coupons` table (+ redeemed_count from coupon_usage) */
export interface TrialCouponRow {
  id: string;
  code: string;
  max_redemptions: number | null;
  percent_off: number;
  expires_at: Date;
  active: boolean;
  note: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  redeemed_count: number;
}

/** Mirrors `plan_coupons` (+ redeemed_count from coupon_usage) */
export interface PlanCouponRow {
  id: string;
  code: string;
  plan: "CREATOR" | "PRO";
  percent_off: number;
  max_redemptions: number | null;
  expires_at: Date;
  active: boolean;
  note: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  redeemed_count: number;
}

/** Recent coupon redemption for control-plane visibility */
export interface CouponRedemptionRow {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  coupon_code: string;
  kind: "TRIAL" | "CREATOR" | "PRO";
  payable_cents: number | null;
  /** From the matching billing_orders row; payable_cents is currency-agnostic minors. */
  currency: string | null;
  redeemed_at: Date;
}

/** Mirrors the plugio_db `social_accounts` table */
export interface DbSocialAccount {
  id: string;
  user_id: string;
  provider: Platform;
  account_name: string | null;
  profile_picture_url: string | null;
  account_type: string;
  is_active: boolean;
  sync_status: string;
  last_successful_sync_at: Date | null;
  created_at: Date;
}

// ─── View/DTO types ───────────────────────────────────────

/** Mirrors the plugio_db `payment_audit_events` table */
export interface DbPaymentAuditEvent {
  id: string;
  user_id: string | null;
  provider: string;
  event_type: string;
  event_key: string | null;
  order_id: string | null;
  payment_id: string | null;
  status: string;
  details: string | null;
  created_at: Date;
}

/** Dashboard metrics */
export interface DashboardStats {
  total_users: number;
  approved_users: number;
  pending_requests: number;
  rejected_users: number;
  new_last_7_days: number;
}

/** Founder / admin home — metrics backed by real Plugio tables only */
export interface BusinessOverview {
  access: DashboardStats;
  revenue: {
    /** Sum of paid SUCCESS audit amounts (amount > 0), USD only */
    total_collected_usd: number;
    /** Same, last 30 days */
    collected_30d_usd: number;
    /** Paid SUCCESS INR amounts — never mixed into USD totals */
    total_collected_inr: number;
    collected_30d_inr: number;
    /** Paid SUCCESS events (amount > 0) — USD invoices */
    paid_checkouts: number;
    paid_checkouts_30d: number;
    paid_checkouts_inr: number;
    paid_checkouts_30d_inr: number;
    /** Estimated MRR from ACTIVE Creator/Pro × USD catalog (seats are not currency-tagged) */
    estimated_mrr_usd: number;
  };
  plans: {
    active_creator: number;
    active_pro: number;
      trialing: number;
      expired: number;
    none: number;
  };
  coupons: {
    active_codes: number;
    redemptions_7d: number;
  };
  social: {
    active_accounts: number;
    users_connected: number;
    youtube: number;
    instagram: number;
    facebook: number;
    sync_failed: number;
    syncing: number;
  };
  content: {
    total: number;
    published: number;
    scheduled: number;
    failed: number;
    drafts: number;
    created_7d: number;
    creators_with_content: number;
  };
  activation: {
    /** Approved users with ≥1 active social account */
    approved_with_social: number;
  };
  attention: {
    pending_beta: number;
    payment_failures_7d: number;
    sync_failed: number;
    content_failed: number;
  };
}

export type AdminUserListFilter =
  | "ALL"
  | "SUBSCRIBED"
  | "FREE"
  | "PAID"
  | "TRIALING"
  | "APPROVED_NO_TRIAL"
  | "TRIAL_NO_PUBLISH"
  | "TRIAL_ENDING";

/** Row in the admin users table */
export interface AdminUserRow {
  id: string;
  name: string | null;
  email: string;
  picture: string | null;
  created_at: Date;
  access_status: BetaStatusValue | null;
  beta_approved: boolean | null;
  subscription_status: SubscriptionStatusValue | null;
}

/** Full user detail for the detail page */
export interface AdminUserDetail extends DbUser {
  subscription_status: SubscriptionStatusValue | null;
  plan_id: PlanIdValue | null;
  has_used_trial: boolean | null;
  billing_interval: "MONTHLY" | "YEARLY" | "TWO_MONTH" | "THREE_MONTH" | null;
  trial_ends_at: Date | null;
  plan_started_at: Date | null;
  pro_period_end_at: Date | null;
  payment_last4: string | null;
  social_accounts: DbSocialAccount[];
  content_count: number;
  published_count: number;
}

/** Row in the beta requests table */
export interface BetaRequestRow {
  id: string;
  name: string | null;
  email: string;
  picture: string | null;
  instagram_username: string | null;
  youtube_channel: string | null;
  facebook_page: string | null;
  instagram_followers: number | null;
  youtube_followers: number | null;
  facebook_followers: number | null;
  application_message: string | null;
  beta_application_submitted_at: Date | null;
  access_status: BetaStatusValue | null;
}

/** Recent activity item for the dashboard */
export interface RecentActivityItem {
  id: string;
  name: string | null;
  email: string;
  picture: string | null;
  action: "registered" | "approved" | "rejected" | "applied";
  occurred_at: Date;
}

/** One cached payload for the Admin Overview page (metrics + feeds). */
export interface AdminOverviewPayload {
  metrics: BusinessOverview;
  activity: RecentActivityItem[];
  /** ISO timestamp when this cached payload was built */
  generatedAt: string;
}

/** Paginated result wrapper */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Admin audit log entry */
export interface AdminAuditLog {
  action:
    | "LOGIN"
    | "LOGOUT"
    | "BETA_APPROVE"
    | "BETA_REJECT"
    | "USER_DISABLE"
    | "USER_ENABLE"
    | "COUPON_CREATE"
    | "COUPON_UPDATE"
    | "COUPON_ACTIVATE"
    | "COUPON_DEACTIVATE"
    | "PLAN_COUPON_CREATE"
    | "PLAN_COUPON_UPDATE"
    | "PLAN_COUPON_ACTIVATE"
    | "PLAN_COUPON_DEACTIVATE"
    | "PLAN_CATALOG_UPDATE"
    | "BILLING_REVOKE"
    // Legacy — kept for reading old audit logs; do not emit new entries
    | "BILLING_GRANT"
    | "BILLING_GRANT_EXTEND"
    | "BILLING_GRANT_CHANGE"
    | "BILLING_GRANT_REVOKE"
    | "BILLING_TRIAL_GRANT"
    | "BILLING_LIFETIME_GRANT";
  adminEmail: string;
  targetUserId?: string;
  targetEmail?: string;
  timestamp: string;
  details?: string;
}

/** Server action result */
export interface ActionResult {
  success: boolean;
  message: string;
  error?: string;
  outreachScript?: string;
  couponCode?: string | null;
}
