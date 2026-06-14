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

/** Mirrors the plugio_db `subscriptions` table */
export interface DbSubscription {
  id: string;
  user_id: string;
  subscription_status: SubscriptionStatusValue;
  plan_started_at: Date | null;
  trial_ends_at: Date | null;
  pro_period_end_at: Date | null;
  has_used_trial: boolean;
  billing_interval: "MONTHLY" | "YEARLY" | null;
  created_at: Date;
  updated_at: Date;
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
  billing_interval: "MONTHLY" | "YEARLY" | null;
  trial_ends_at: Date | null;
  plan_started_at: Date | null;
  pro_period_end_at: Date | null;
  social_accounts: DbSocialAccount[];
  content_count: number;
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
    | "USER_ENABLE";
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
}
