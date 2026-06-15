/**
 * Plugio Admin — Database Queries
 *
 * All queries use parameterized statements (?) to prevent SQL injection.
 * NEVER use string interpolation for user input inside SQL.
 *
 * These functions query the existing plugio_db tables directly.
 * No new tables are created — we work with the existing schema.
 */

import { pool } from "./index";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { PAGE_SIZE } from "@/constants";
import type {
  DashboardStats,
  AdminUserRow,
  AdminUserDetail,
  BetaRequestRow,
  RecentActivityItem,
  PaginatedResult,
  DbSocialAccount,
  DbPaymentAuditEvent,
} from "@/types";

// ─── Dashboard ────────────────────────────────────────────

/**
 * Aggregate user statistics for the dashboard overview.
 * A user has "full platform access" when:
 *   access_status = APPROVED AND beta_approved = 1 AND is_whitelisted = 1
 * This mirrors User.hasFullPlatformBetaAccess() from the Spring Boot backend.
 */
export const getDashboardStats = unstable_cache(
  cache(async (): Promise<DashboardStats> => {
    const [rows] = await pool.execute<any[]>(`
      SELECT
        COUNT(*)                                                                                     AS total_users,
        SUM(CASE WHEN access_status = 'APPROVED'
                 AND beta_approved = 1
                 AND is_whitelisted = 1
            THEN 1 ELSE 0 END)                                                                      AS approved_users,
        SUM(CASE WHEN access_status = 'PENDING' THEN 1 ELSE 0 END)                                 AS pending_requests,
        SUM(CASE WHEN access_status = 'REJECTED' THEN 1 ELSE 0 END)                                AS rejected_users,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END)             AS new_last_7_days
      FROM users
    `);

    const row = rows[0];
    return {
      total_users: Number(row.total_users ?? 0),
      approved_users: Number(row.approved_users ?? 0),
      pending_requests: Number(row.pending_requests ?? 0),
      rejected_users: Number(row.rejected_users ?? 0),
      new_last_7_days: Number(row.new_last_7_days ?? 0),
    };
  }),
  ["dashboard-stats"],
  { revalidate: 60, tags: ["dashboard", "users", "beta"] }
);

/**
 * Recent activity feed for the dashboard.
 * Shows latest registrations, beta applications, approvals, and rejections.
 */
export const getRecentActivity = unstable_cache(
  cache(async (limit = 10): Promise<RecentActivityItem[]> => {
    // Clamp to a safe integer — UNION sub-queries don't support ? placeholders
    // for LIMIT in all MySQL versions, so we validate strictly here.
    const safeLimit = Math.min(Math.max(1, Math.floor(Number(limit))), 100);
    if (!Number.isFinite(safeLimit)) throw new Error("Invalid limit");

    const [rows] = await pool.execute<any[]>(
      `
      (
        SELECT id, name, email, picture, created_at AS occurred_at, 'registered' AS action
        FROM users
        ORDER BY created_at DESC
        LIMIT ${safeLimit}
      )
      UNION ALL
      (
        SELECT id, name, email, picture, beta_application_submitted_at AS occurred_at, 'applied' AS action
        FROM users
        WHERE beta_application_submitted_at IS NOT NULL
        ORDER BY beta_application_submitted_at DESC
        LIMIT ${safeLimit}
      )
      UNION ALL
      (
        SELECT id, name, email, picture, updated_at AS occurred_at, 'approved' AS action
        FROM users
        WHERE access_status = 'APPROVED'
        ORDER BY updated_at DESC
        LIMIT ${safeLimit}
      )
      UNION ALL
      (
        SELECT id, name, email, picture, updated_at AS occurred_at, 'rejected' AS action
        FROM users
        WHERE access_status = 'REJECTED'
        ORDER BY updated_at DESC
        LIMIT ${safeLimit}
      )
      ORDER BY occurred_at DESC
      LIMIT ${safeLimit}
    `
    );

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      picture: r.picture,
      action: r.action,
      occurred_at: new Date(r.occurred_at),
    }));
  }),
  ["recent-activity"],
  { revalidate: 60, tags: ["dashboard", "users", "beta", "activity"] }
);

// ─── Users ────────────────────────────────────────────────

/**
 * Paginated user list with optional search.
 * Searches across name AND email columns.
 */
export async function getUsers(
  search: string,
  filter: "ALL" | "SUBSCRIBED" | "FREE",
  page: number,
  pageSize: number = PAGE_SIZE
): Promise<PaginatedResult<AdminUserRow>> {
  const offset = (page - 1) * pageSize;
  const searchPattern = search.trim() ? `%${search.trim()}%` : "%";

  let filterClause = "";
  if (filter === "SUBSCRIBED") {
    filterClause = "AND (s.subscription_status = 'ACTIVE' OR s.subscription_status = 'TRIALING')";
  } else if (filter === "FREE") {
    filterClause = "AND (s.subscription_status IS NULL OR s.subscription_status NOT IN ('ACTIVE', 'TRIALING'))";
  }

  const safePageSize = Math.min(Math.max(1, Math.floor(pageSize)), 200);
  const safeOffset = Math.max(0, Math.floor(offset));

  const [rows] = await pool.execute<any[]>(
    `
    SELECT
      u.id,
      u.name,
      u.email,
      u.picture,
      u.created_at,
      u.access_status,
      u.beta_approved,
      s.subscription_status
    FROM users u
    LEFT JOIN subscriptions s ON s.user_id = u.id
    WHERE (u.name LIKE ? OR u.email LIKE ?) ${filterClause}
    ORDER BY u.created_at DESC
    LIMIT ${safePageSize} OFFSET ${safeOffset}
  `,
    [searchPattern, searchPattern]
  );

  const [countRows] = await pool.execute<any[]>(
    `SELECT COUNT(*) AS total FROM users u LEFT JOIN subscriptions s ON s.user_id = u.id WHERE (u.name LIKE ? OR u.email LIKE ?) ${filterClause}`,
    [searchPattern, searchPattern]
  );

  const total = Number(countRows[0].total ?? 0);

  return {
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      picture: r.picture,
      created_at: new Date(r.created_at),
      access_status: r.access_status,
      beta_approved: Boolean(r.beta_approved),
      subscription_status: r.subscription_status ?? null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Full user detail for the user detail page.
 * Fetches user, subscription, social accounts, and content count in parallel.
 */
export async function getUserDetail(
  userId: string
): Promise<AdminUserDetail | null> {
  // Main user + subscription join
  const [rows] = await pool.execute<any[]>(
    `
    SELECT
      u.*,
      s.subscription_status,
      s.billing_interval,
      s.trial_ends_at,
      s.plan_started_at,
      s.pro_period_end_at
    FROM users u
    LEFT JOIN subscriptions s ON s.user_id = u.id
    WHERE u.id = ?
    LIMIT 1
  `,
    [userId]
  );

  if (!rows.length) return null;

  // Social accounts
  const [socialRows] = await pool.execute<any[]>(
    `
    SELECT id, user_id, provider, account_name, profile_picture_url, account_type, is_active, sync_status, last_successful_sync_at, created_at
    FROM social_accounts
    WHERE user_id = ?
    ORDER BY created_at ASC
  `,
    [userId]
  );

  // Content count
  let contentCount = 0;
  try {
    const [contentCountRows] = await pool.execute<any[]>(
      `SELECT COUNT(*) AS count FROM content WHERE user_id = ?`,
      [userId]
    );
    contentCount = Number(contentCountRows[0]?.count ?? 0);
  } catch (error: any) {
    // If the table doesn't exist yet, just default to 0
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      console.warn("Error fetching content count:", error.message);
    }
  }

  const user = rows[0];
  const socialAccounts: DbSocialAccount[] = socialRows.map((s) => ({
    ...s,
    is_active: Boolean(s.is_active),
    created_at: new Date(s.created_at),
    last_successful_sync_at: s.last_successful_sync_at
      ? new Date(s.last_successful_sync_at)
      : null,
  }));

  return {
    ...user,
    is_public: Boolean(user.is_public),
    beta_approved: user.beta_approved !== null ? Boolean(user.beta_approved) : null,
    is_whitelisted: user.is_whitelisted !== null ? Boolean(user.is_whitelisted) : null,
    created_at: new Date(user.created_at),
    updated_at: new Date(user.updated_at),
    beta_application_submitted_at: user.beta_application_submitted_at
      ? new Date(user.beta_application_submitted_at)
      : null,
    trial_ends_at: user.trial_ends_at ? new Date(user.trial_ends_at) : null,
    plan_started_at: user.plan_started_at
      ? new Date(user.plan_started_at)
      : null,
    pro_period_end_at: user.pro_period_end_at ? new Date(user.pro_period_end_at) : null,
    social_accounts: socialAccounts,
    content_count: contentCount,
  };
}

// ─── Beta Requests ────────────────────────────────────────

/**
 * Paginated list of beta access applications.
 * A beta request exists when beta_application_submitted_at IS NOT NULL.
 * Filter by status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'
 */
export async function getBetaRequests(
  status: "ALL" | "PENDING" | "APPROVED" | "REJECTED",
  search: string,
  page: number,
  pageSize: number = PAGE_SIZE
): Promise<PaginatedResult<BetaRequestRow>> {
  const offset = (page - 1) * pageSize;
  const searchPattern = search.trim() ? `%${search.trim()}%` : "%";

  // Status is a validated enum — safe to use directly in WHERE clause
  const safeStatus =
    status === "ALL"
      ? null
      : ["PENDING", "APPROVED", "REJECTED"].includes(status)
        ? status
        : null;

  const baseParams: (string | number)[] = [searchPattern, searchPattern];
  if (safeStatus) baseParams.push(safeStatus);

  const statusClause = safeStatus ? "AND access_status = ?" : "";

  const safePageSize = Math.min(Math.max(1, Math.floor(pageSize)), 200);
  const safeOffset = Math.max(0, Math.floor(offset));

  const [rows] = await pool.execute<any[]>(
    `SELECT
      id, name, email, picture,
      instagram_username, youtube_channel, facebook_page,
      instagram_followers, youtube_followers, facebook_followers,
      application_message, beta_application_submitted_at, access_status
    FROM users
    WHERE beta_application_submitted_at IS NOT NULL
      AND (name LIKE ? OR email LIKE ?)
      ${statusClause}
    ORDER BY beta_application_submitted_at DESC
    LIMIT ${safePageSize} OFFSET ${safeOffset}`,
    baseParams
  );

  const [countRows] = await pool.execute<any[]>(
    `SELECT COUNT(*) AS total
    FROM users
    WHERE beta_application_submitted_at IS NOT NULL
      AND (name LIKE ? OR email LIKE ?)
      ${statusClause}`,
    baseParams
  );

  const total = Number(countRows[0]?.total ?? 0);

  return {
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      picture: r.picture,
      instagram_username: r.instagram_username,
      youtube_channel: r.youtube_channel,
      facebook_page: r.facebook_page,
      instagram_followers: r.instagram_followers
        ? Number(r.instagram_followers)
        : null,
      youtube_followers: r.youtube_followers
        ? Number(r.youtube_followers)
        : null,
      facebook_followers: r.facebook_followers
        ? Number(r.facebook_followers)
        : null,
      application_message: r.application_message,
      beta_application_submitted_at: r.beta_application_submitted_at
        ? new Date(r.beta_application_submitted_at)
        : null,
      access_status: r.access_status,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ─── Beta Mutations ───────────────────────────────────────

/**
 * Approve a beta access request.
 * Sets access_status = APPROVED, beta_approved = 1, is_whitelisted = 1
 * This exactly mirrors what BetaOnboardingService does in the Spring Boot backend.
 */
export async function approveBetaUser(userId: string): Promise<void> {
  await pool.execute(
    `
    UPDATE users
    SET access_status = 'APPROVED',
        beta_approved = 1,
        is_whitelisted = 1,
        updated_at = NOW(6)
    WHERE id = ?
  `,
    [userId]
  );
}

/**
 * Reject a beta access request.
 * Sets access_status = REJECTED, beta_approved = 0
 */
export async function rejectBetaUser(userId: string): Promise<void> {
  await pool.execute(
    `
    UPDATE users
    SET access_status = 'REJECTED',
        beta_approved = 0,
        updated_at = NOW(6)
    WHERE id = ?
  `,
    [userId]
  );
}

// ─── User lookups ─────────────────────────────────────────

/**
 * Get minimal user info by ID for logging/display purposes.
 */
export async function getUserEmailById(
  userId: string
): Promise<{ email: string; name: string | null } | null> {
  const [rows] = await pool.execute<any[]>(
    `SELECT email, name FROM users WHERE id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}

// ─── Helpers ──────────────────────────────────────────────

/**
 * Escape special characters in a search string for safe use in SQL LIKE patterns.
 * Always use alongside parameterized queries — never string-interpolate user input.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

// ─── Payment Audit Events ──────────────────────────────────

/**
 * Fetch all payment audit events for a specific user
 */
export async function getPaymentAuditEventsForUser(
  userId: string
): Promise<DbPaymentAuditEvent[]> {
  const [rows] = await pool.execute<any[]>(
    `SELECT id, user_id, provider, event_type, event_key, order_id, payment_id, status, details, created_at
     FROM payment_audit_events
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId]
  );
  return rows.map((r) => ({
    ...r,
    created_at: new Date(r.created_at),
  }));
}

/**
 * Global Paginated Payment Audit Events
 */
export async function getGlobalPaymentAuditEvents(
  page: number,
  pageSize: number = 20
): Promise<PaginatedResult<DbPaymentAuditEvent & { user_name: string | null; user_email: string | null }>> {
  const safePageSize = Math.min(Math.max(1, Math.floor(pageSize)), 200);
  const safeOffset = Math.max(0, Math.floor((page - 1) * safePageSize));

  const [rows] = await pool.execute<any[]>(
    `
    SELECT
      p.id, p.user_id, p.provider, p.event_type, p.event_key,
      p.order_id, p.payment_id, p.status, p.details, p.created_at,
      u.name AS user_name,
      u.email AS user_email
    FROM payment_audit_events p
    LEFT JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC
    LIMIT ${safePageSize} OFFSET ${safeOffset}
  `
  );

  const [countRows] = await pool.execute<any[]>(
    `SELECT COUNT(*) AS total FROM payment_audit_events`
  );

  const total = Number(countRows[0]?.total ?? 0);

  return {
    items: rows.map((r) => ({ ...r, created_at: new Date(r.created_at) })),
    total,
    page,
    pageSize: safePageSize,
    totalPages: Math.ceil(total / safePageSize),
  };
}
