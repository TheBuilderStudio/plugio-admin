/**
 * Plugio Admin — Database Queries
 *
 * All queries use parameterized statements (?) to prevent SQL injection.
 * NEVER use string interpolation for user input inside SQL.
 *
 * These functions query the existing plugio_db tables directly.
 * No new tables are created — we work with the existing schema.
 */

import { pool, getActivePool, getPoolForContext } from "./index";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { PAGE_SIZE } from "@/constants";
import type {
  DashboardStats,
  BusinessOverview,
  ExpiringGrantRow,
  AdminUserRow,
  AdminUserDetail,
  BetaRequestRow,
  RecentActivityItem,
  PaginatedResult,
  DbSocialAccount,
  DbPaymentAuditEvent,
  TrialCouponRow,
  CouponRedemptionRow,
  AdminAccessGrantRow,
  GrantPlanId,
  GrantDurationDays,
  PlanIdValue,
} from "@/types";

// ─── Dashboard ────────────────────────────────────────────

/**
 * Aggregate user statistics for the dashboard overview.
 * A user has "full platform access" when:
 *   access_status = APPROVED AND beta_approved = 1 AND is_whitelisted = 1
 * This mirrors User.hasFullPlatformBetaAccess() from the Spring Boot backend.
 */
export const getDashboardStats = unstable_cache(
  cache(async (dbContext: "production" | "staging" = "production"): Promise<DashboardStats> => {
    const db = getPoolForContext(dbContext);
    const [rows] = await db.execute<any[]>(`
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
  ["dashboard-stats-v2"],
  { revalidate: 60, tags: ["dashboard", "users", "beta"] }
);

/**
 * Recent activity feed for the dashboard.
 * Shows latest registrations, beta applications, approvals, and rejections.
 */
export const getRecentActivity = unstable_cache(
  cache(async (limit = 10, dbContext: "production" | "staging" = "production"): Promise<RecentActivityItem[]> => {
    // Clamp to a safe integer — UNION sub-queries don't support ? placeholders
    // for LIMIT in all MySQL versions, so we validate strictly here.
    const safeLimit = Math.min(Math.max(1, Math.floor(Number(limit))), 100);
    if (!Number.isFinite(safeLimit)) throw new Error("Invalid limit");
    const db = getPoolForContext(dbContext);

    const [rows] = await db.execute<any[]>(
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
  ["recent-activity-v2"],
  { revalidate: 60, tags: ["dashboard", "users", "beta", "activity"] }
);

/**
 * @deprecated Prefer getAdminOverview() — single cached founder payload.
 * Kept as a thin wrapper for any legacy callers.
 */
export async function getBusinessOverview(
  dbContext: "production" | "staging"
): Promise<BusinessOverview> {
  const { getAdminOverview } = await import("./admin-overview");
  const payload = await getAdminOverview(dbContext);
  return payload.metrics;
}

/**
 * Lightweight pending beta count for chrome badges (cached).
 * Intentionally separate from full overview so navigating Users/Settings
 * does not cold-start the heavy aggregate query.
 */
export const getPendingBetaCount = unstable_cache(
  cache(async (dbContext: "production" | "staging" = "production"): Promise<number> => {
    const db = getPoolForContext(dbContext);
    const [rows] = await db.execute<any[]>(
      `SELECT COUNT(*) AS pending FROM users WHERE access_status = 'PENDING'`
    );
    return Number(rows[0]?.pending ?? 0);
  }),
  ["pending-beta-count-v2"],
  { revalidate: 60, tags: ["admin-overview", "dashboard", "users", "beta"] }
);

/**
 * Complimentary grants ending within the next 7 days.
 */
export async function listExpiringGrants(limit = 8): Promise<ExpiringGrantRow[]> {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 50);
  try {
    const [rows] = await pool.execute<any[]>(
      `
      SELECT
        g.id,
        g.user_id,
        g.plan_id,
        g.ends_at,
        g.duration_days,
        u.email AS user_email,
        u.name AS user_name
      FROM admin_access_grants g
      LEFT JOIN users u ON u.id = g.user_id
      WHERE g.status = 'ACTIVE'
        AND g.ends_at > NOW(6)
        AND g.ends_at <= DATE_ADD(NOW(6), INTERVAL 7 DAY)
      ORDER BY g.ends_at ASC
      LIMIT ${safeLimit}
    `
    );
    return rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      user_email: r.user_email ?? null,
      user_name: r.user_name ?? null,
      plan_id: r.plan_id,
      ends_at: new Date(r.ends_at),
      duration_days: Number(r.duration_days),
    }));
  } catch (error: any) {
    if (error?.code === "ER_NO_SUCH_TABLE") return [];
    throw error;
  }
}

// ─── Users ────────────────────────────────────────────────

/**
 * Paginated user list with optional search.
 * Searches across name AND email columns.
 */
export async function getUsers(
  search: string,
  filter: "ALL" | "SUBSCRIBED" | "FREE" | "PAID" | "TRIALING",
  page: number,
  pageSize: number = PAGE_SIZE
): Promise<PaginatedResult<AdminUserRow>> {
  const offset = (page - 1) * pageSize;
  const searchPattern = search.trim() ? `%${search.trim()}%` : "%";

  let filterClause = "";
  if (filter === "PAID") {
    // Paid Creator/Pro live plans only (excludes trials)
    filterClause = "AND s.subscription_status = 'ACTIVE' AND s.plan_id IN ('CREATOR', 'PRO')";
  } else if (filter === "TRIALING") {
    filterClause = "AND s.subscription_status = 'TRIALING'";
  } else if (filter === "SUBSCRIBED") {
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
  const [[rows], socialResult, contentResult, activeGrant] = await Promise.all([
    pool.execute<any[]>(
      `
      SELECT
        u.*,
        s.subscription_status,
        s.plan_id,
        s.has_used_trial,
        s.billing_interval,
        s.trial_ends_at,
        s.plan_started_at,
        s.pro_period_end_at,
        s.payment_last4
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id
      WHERE u.id = ?
      LIMIT 1
    `,
      [userId]
    ),
    pool.execute<any[]>(
      `
      SELECT id, user_id, provider, account_name, profile_picture_url, account_type, is_active, sync_status, last_successful_sync_at, created_at
      FROM social_accounts
      WHERE user_id = ?
      ORDER BY created_at ASC
    `,
      [userId]
    ),
    pool
      .execute<any[]>(`SELECT COUNT(*) AS count FROM content WHERE user_id = ?`, [userId])
      .then((r) => r)
      .catch((error: any) => {
        if (error?.code !== "ER_NO_SUCH_TABLE") {
          console.warn("Error fetching content count:", error.message);
        }
        return [[{ count: 0 }]] as any;
      }),
    getActiveGrantForUser(userId),
  ]);

  if (!rows.length) return null;

  const [socialRows] = socialResult;
  const [contentCountRows] = contentResult;
  const contentCount = Number(contentCountRows[0]?.count ?? 0);

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
    plan_id: user.plan_id ?? null,
    has_used_trial:
      user.has_used_trial !== null && user.has_used_trial !== undefined
        ? Boolean(user.has_used_trial)
        : null,
    payment_last4: user.payment_last4 ?? null,
    trial_ends_at: user.trial_ends_at ? new Date(user.trial_ends_at) : null,
    plan_started_at: user.plan_started_at
      ? new Date(user.plan_started_at)
      : null,
    pro_period_end_at: user.pro_period_end_at ? new Date(user.pro_period_end_at) : null,
    active_grant: activeGrant,
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
        is_whitelisted = 0,
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

// ─── Trial Coupons ────────────────────────────────────────

function mapTrialCouponRow(r: any): TrialCouponRow {
  return {
    id: r.id,
    code: r.code,
    max_redemptions:
      r.max_redemptions === null || r.max_redemptions === undefined
        ? null
        : Number(r.max_redemptions),
    active: Boolean(r.active),
    note: r.note ?? null,
    created_by: r.created_by ?? null,
    created_at: new Date(r.created_at),
    updated_at: new Date(r.updated_at),
    redeemed_count: Number(r.redeemed_count ?? 0),
  };
}

/**
 * List all trial coupons with redeemed_count from coupon_usage.
 */
export async function listTrialCoupons(): Promise<TrialCouponRow[]> {
  const [rows] = await pool.execute<any[]>(
    `
    SELECT
      tc.id,
      tc.code,
      tc.max_redemptions,
      tc.active,
      tc.note,
      tc.created_by,
      tc.created_at,
      tc.updated_at,
      COALESCE(cu.redeemed_count, 0) AS redeemed_count
    FROM trial_coupons tc
    LEFT JOIN coupon_usage cu ON cu.coupon_code = tc.code
    ORDER BY tc.created_at DESC
  `
  );
  return rows.map(mapTrialCouponRow);
}

/**
 * Look up a single trial coupon by code (normalized UPPERCASE expected).
 */
export async function getTrialCouponByCode(
  code: string
): Promise<TrialCouponRow | null> {
  const [rows] = await pool.execute<any[]>(
    `
    SELECT
      tc.id,
      tc.code,
      tc.max_redemptions,
      tc.active,
      tc.note,
      tc.created_by,
      tc.created_at,
      tc.updated_at,
      COALESCE(cu.redeemed_count, 0) AS redeemed_count
    FROM trial_coupons tc
    LEFT JOIN coupon_usage cu ON cu.coupon_code = tc.code
    WHERE tc.code = ?
    LIMIT 1
  `,
    [code]
  );
  return rows[0] ? mapTrialCouponRow(rows[0]) : null;
}

/**
 * Create a new trial coupon. Codes must already be UPPERCASE-validated.
 */
export async function createTrialCoupon(params: {
  code: string;
  maxRedemptions: number | null;
  note: string | null;
  createdBy: string;
}): Promise<TrialCouponRow> {
  const id = crypto.randomUUID();
  try {
    await pool.execute(
      `
      INSERT INTO trial_coupons
        (id, code, max_redemptions, active, note, created_by, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?, NOW(6), NOW(6))
    `,
      [id, params.code, params.maxRedemptions, params.note, params.createdBy]
    );
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") {
      const dup = new Error(`Coupon code ${params.code} already exists`);
      (dup as any).code = "DUPLICATE";
      throw dup;
    }
    throw error;
  }

  const created = await getTrialCouponByCode(params.code);
  if (!created) {
    throw new Error("Failed to load created coupon");
  }
  return created;
}

/**
 * Update coupon metadata (max_redemptions, note, active).
 * @returns affected row count
 */
export async function updateTrialCoupon(
  id: string,
  updates: {
    maxRedemptions?: number | null;
    note?: string | null;
    active?: boolean;
  }
): Promise<number> {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.maxRedemptions !== undefined) {
    sets.push("max_redemptions = ?");
    values.push(updates.maxRedemptions);
  }
  if (updates.note !== undefined) {
    sets.push("note = ?");
    values.push(updates.note);
  }
  if (updates.active !== undefined) {
    sets.push("active = ?");
    values.push(updates.active ? 1 : 0);
  }

  if (sets.length === 0) return 0;

  sets.push("updated_at = NOW(6)");
  values.push(id);

  const [result] = await pool.execute<any>(
    `UPDATE trial_coupons SET ${sets.join(", ")} WHERE id = ?`,
    values
  );
  return Number(result?.affectedRows ?? 0);
}

/**
 * Activate or deactivate a trial coupon.
 * @returns affected row count
 */
export async function setTrialCouponActive(
  id: string,
  active: boolean
): Promise<number> {
  const [result] = await pool.execute<any>(
    `
    UPDATE trial_coupons
    SET active = ?, updated_at = NOW(6)
    WHERE id = ?
  `,
    [active ? 1 : 0, id]
  );
  return Number(result?.affectedRows ?? 0);
}

// ─── Admin Access Grants ──────────────────────────────────

function mapAdminGrantRow(r: any): AdminAccessGrantRow {
  return {
    id: r.id,
    user_id: r.user_id,
    plan_id: r.plan_id,
    starts_at: new Date(r.starts_at),
    ends_at: new Date(r.ends_at),
    status: r.status,
    duration_days: Number(r.duration_days),
    reason: r.reason ?? null,
    notes: r.notes ?? null,
    granted_by_admin_email: r.granted_by_admin_email,
    previous_effective_plan: r.previous_effective_plan ?? null,
    revoked_at: r.revoked_at ? new Date(r.revoked_at) : null,
    revoked_by_admin_email: r.revoked_by_admin_email ?? null,
    created_at: new Date(r.created_at),
    updated_at: new Date(r.updated_at),
  };
}

/**
 * Active complimentary grant for a user (status ACTIVE and ends_at > now).
 * Prefers higher plan tier, then later ends_at.
 */
export async function getActiveGrantForUser(
  userId: string
): Promise<AdminAccessGrantRow | null> {
  try {
    const [rows] = await pool.execute<any[]>(
      `
      SELECT *
      FROM admin_access_grants
      WHERE user_id = ?
        AND status = 'ACTIVE'
        AND starts_at <= NOW(6)
        AND ends_at > NOW(6)
      ORDER BY
        CASE plan_id WHEN 'PRO' THEN 2 WHEN 'CREATOR' THEN 1 ELSE 0 END DESC,
        ends_at DESC
      LIMIT 1
    `,
      [userId]
    );
    return rows[0] ? mapAdminGrantRow(rows[0]) : null;
  } catch (error: any) {
    if (error.code === "ER_NO_SUCH_TABLE") return null;
    throw error;
  }
}

/**
 * All grants for a user, newest first.
 */
export async function listGrantsForUser(
  userId: string
): Promise<AdminAccessGrantRow[]> {
  try {
    const [rows] = await pool.execute<any[]>(
      `
      SELECT *
      FROM admin_access_grants
      WHERE user_id = ?
      ORDER BY created_at DESC
    `,
      [userId]
    );
    return rows.map(mapAdminGrantRow);
  } catch (error: any) {
    if (error.code === "ER_NO_SUCH_TABLE") return [];
    throw error;
  }
}

/**
 * Recent coupon redemptions for the control panel (who used which code).
 */
export async function listRecentCouponRedemptions(
  limit = 25
): Promise<CouponRedemptionRow[]> {
  const safeLimit = Math.min(Math.max(1, limit), 100);
  try {
    const [rows] = await pool.execute<any[]>(
      `
      SELECT
        r.id,
        r.user_id,
        r.coupon_code,
        r.redeemed_at,
        u.email AS user_email,
        u.name AS user_name
      FROM coupon_redemptions r
      LEFT JOIN users u ON u.id = r.user_id
      ORDER BY r.redeemed_at DESC
      LIMIT ${safeLimit}
    `
    );
    return rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      user_email: r.user_email ?? null,
      user_name: r.user_name ?? null,
      coupon_code: r.coupon_code,
      redeemed_at: new Date(r.redeemed_at),
    }));
  } catch (error: any) {
    if (error.code === "ER_NO_SUCH_TABLE") return [];
    throw error;
  }
}

/**
 * Create a new complimentary access grant.
 */
export async function createAdminGrant(params: {
  userId: string;
  planId: GrantPlanId;
  startsAt: Date;
  endsAt: Date;
  durationDays: number;
  reason: string | null;
  notes: string | null;
  grantedByAdminEmail: string;
  previousEffectivePlan: PlanIdValue | null;
}): Promise<AdminAccessGrantRow> {
  const id = crypto.randomUUID();
  await pool.execute(
    `
    INSERT INTO admin_access_grants (
      id, user_id, plan_id, starts_at, ends_at, status, duration_days,
      reason, notes, granted_by_admin_email, previous_effective_plan,
      revoked_at, revoked_by_admin_email, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, 'ACTIVE', ?,
      ?, ?, ?, ?,
      NULL, NULL, NOW(6), NOW(6)
    )
  `,
    [
      id,
      params.userId,
      params.planId,
      params.startsAt,
      params.endsAt,
      params.durationDays,
      params.reason,
      params.notes,
      params.grantedByAdminEmail,
      params.previousEffectivePlan,
    ]
  );

  const [rows] = await pool.execute<any[]>(
    `SELECT * FROM admin_access_grants WHERE id = ? LIMIT 1`,
    [id]
  );
  return mapAdminGrantRow(rows[0]);
}

/**
 * Atomically revoke all live ACTIVE grants for a user and insert one new grant.
 * Prevents dual-ACTIVE races and silent access loss on replace.
 */
export async function replaceAdminGrantAtomic(params: {
  userId: string;
  planId: GrantPlanId;
  startsAt: Date;
  endsAt: Date;
  durationDays: number;
  reason: string | null;
  notes: string | null;
  grantedByAdminEmail: string;
  previousEffectivePlan: PlanIdValue | null;
}): Promise<{ grant: AdminAccessGrantRow; revokedCount: number }> {
  const activePool = await getActivePool();
  const conn = await activePool.getConnection();
  const id = crypto.randomUUID();
  try {
    await conn.beginTransaction();

    const [revokeResult] = await conn.execute<any>(
      `
      UPDATE admin_access_grants
      SET status = 'REVOKED',
          revoked_at = NOW(6),
          revoked_by_admin_email = ?,
          updated_at = NOW(6)
      WHERE user_id = ?
        AND status = 'ACTIVE'
      `,
      [params.grantedByAdminEmail, params.userId]
    );
    const revokedCount = Number(revokeResult?.affectedRows ?? 0);

    await conn.execute(
      `
      INSERT INTO admin_access_grants (
        id, user_id, plan_id, starts_at, ends_at, status, duration_days,
        reason, notes, granted_by_admin_email, previous_effective_plan,
        revoked_at, revoked_by_admin_email, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, 'ACTIVE', ?,
        ?, ?, ?, ?,
        NULL, NULL, NOW(6), NOW(6)
      )
      `,
      [
        id,
        params.userId,
        params.planId,
        params.startsAt,
        params.endsAt,
        params.durationDays,
        params.reason,
        params.notes,
        params.grantedByAdminEmail,
        params.previousEffectivePlan,
      ]
    );

    await conn.commit();

    const [rows] = await activePool.execute<any[]>(
      `SELECT * FROM admin_access_grants WHERE id = ? LIMIT 1`,
      [id]
    );
    return { grant: mapAdminGrantRow(rows[0]), revokedCount };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Update fields on an existing grant (extend / change plan / notes).
 */
export async function updateAdminGrant(
  id: string,
  updates: {
    planId?: GrantPlanId;
    endsAt?: Date;
    durationDays?: number;
    reason?: string | null;
    notes?: string | null;
  }
): Promise<number> {
  const sets: string[] = [];
  const values: (string | number | Date | null)[] = [];

  if (updates.planId !== undefined) {
    sets.push("plan_id = ?");
    values.push(updates.planId);
  }
  if (updates.endsAt !== undefined) {
    sets.push("ends_at = ?");
    values.push(updates.endsAt);
  }
  if (updates.durationDays !== undefined) {
    sets.push("duration_days = ?");
    values.push(updates.durationDays);
  }
  if (updates.reason !== undefined) {
    sets.push("reason = ?");
    values.push(updates.reason);
  }
  if (updates.notes !== undefined) {
    sets.push("notes = ?");
    values.push(updates.notes);
  }

  if (sets.length === 0) return 0;

  sets.push("updated_at = NOW(6)");
  values.push(id);

  const [result] = await pool.execute<any>(
    `UPDATE admin_access_grants SET ${sets.join(", ")} WHERE id = ?`,
    values
  );
  return Number(result?.affectedRows ?? 0);
}

/**
 * Revoke an active grant (does NOT touch subscriptions).
 */
export async function revokeAdminGrant(
  id: string,
  revokedBy: string
): Promise<void> {
  await pool.execute(
    `
    UPDATE admin_access_grants
    SET status = 'REVOKED',
        revoked_at = NOW(6),
        revoked_by_admin_email = ?,
        updated_at = NOW(6)
    WHERE id = ?
  `,
    [revokedBy, id]
  );
}

/**
 * Subscription snapshot used for grant eligibility / previous_effective_plan.
 */
export async function getSubscriptionSnapshotForUser(userId: string): Promise<{
  subscription_status: string | null;
  plan_id: PlanIdValue | null;
  pro_period_end_at: Date | null;
  has_used_trial: boolean | null;
} | null> {
  const [rows] = await pool.execute<any[]>(
    `
    SELECT subscription_status, plan_id, pro_period_end_at, has_used_trial
    FROM subscriptions
    WHERE user_id = ?
    LIMIT 1
  `,
    [userId]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    subscription_status: r.subscription_status ?? null,
    plan_id: r.plan_id ?? null,
    pro_period_end_at: r.pro_period_end_at ? new Date(r.pro_period_end_at) : null,
    has_used_trial:
      r.has_used_trial !== null && r.has_used_trial !== undefined
        ? Boolean(r.has_used_trial)
        : null,
  };
}
