/**
 * Plugio Admin — Database Queries
 *
 * All queries use parameterized statements (?) to prevent SQL injection.
 * NEVER use string interpolation for user input inside SQL.
 *
 * These functions query the existing plugio_db tables directly.
 * billing_plan_settings is the admin Plans catalog (V44).
 */

import { pool, getPoolForContext, getActivePool } from "./index";
import { parseMysqlUtcDate, toMysqlUtcDateTime } from "@/lib/coupon-expiry";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { PAGE_SIZE, PLAN_CATALOG_USD, type AdminPlanCatalog } from "@/constants";
import type {
  DashboardStats,
  AdminUserRow,
  AdminUserDetail,
  AdminUserListFilter,
  BetaRequestRow,
  PaginatedResult,
  DbSocialAccount,
  DbPaymentAuditEvent,
  TrialCouponRow,
  PlanCouponRow,
  CouponRedemptionRow,
  RecentActivityItem,
  BusinessOverview,
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

// ─── Users ────────────────────────────────────────────────

/**
 * Paginated user list with optional search.
 * Searches across name AND email columns.
 */
export async function getUsers(
  search: string,
  filter: AdminUserListFilter,
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
  } else if (filter === "APPROVED_NO_TRIAL") {
    filterClause =
      "AND u.access_status = 'APPROVED' AND (s.subscription_status IS NULL OR s.subscription_status = 'NONE')";
  } else if (filter === "TRIAL_NO_PUBLISH") {
    filterClause = `AND s.subscription_status = 'TRIALING' AND NOT EXISTS (
      SELECT 1 FROM content c
      WHERE c.user_id = u.id AND LOWER(c.status) IN ('published', 'scheduled')
    )`;
  } else if (filter === "TRIAL_ENDING") {
    filterClause = `AND s.subscription_status = 'TRIALING'
      AND s.trial_ends_at IS NOT NULL
      AND s.trial_ends_at > NOW(6)
      AND s.trial_ends_at <= DATE_ADD(NOW(6), INTERVAL 2 DAY)`;
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
  const [[rows], socialResult, contentResult] = await Promise.all([
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
      .execute<any[]>(
        `SELECT
           COUNT(*) AS count,
           SUM(CASE WHEN LOWER(status) IN ('published', 'scheduled') THEN 1 ELSE 0 END) AS published_count
         FROM content WHERE user_id = ?`,
        [userId]
      )
      .then((r) => r)
      .catch((error: any) => {
        if (error?.code !== "ER_NO_SUCH_TABLE") {
          console.warn("Error fetching content count:", error.message);
        }
        return [[{ count: 0, published_count: 0 }]] as any;
      }),
  ]);

  if (!rows.length) return null;

  const [socialRows] = socialResult;
  const [contentCountRows] = contentResult;
  const contentCount = Number(contentCountRows[0]?.count ?? 0);
  const publishedCount = Number(contentCountRows[0]?.published_count ?? 0);

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
    social_accounts: socialAccounts,
    content_count: contentCount,
    published_count: publishedCount,
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
    percent_off: Number(r.percent_off ?? 90),
    expires_at: parseMysqlUtcDate(r.expires_at) ?? new Date(0),
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
      tc.percent_off,
      tc.expires_at,
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
      tc.percent_off,
      tc.expires_at,
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
  percentOff: number;
  expiresAt: Date;
  note: string | null;
  createdBy: string;
}): Promise<TrialCouponRow> {
  const id = crypto.randomUUID();
  const activePool = await getActivePool();
  const conn = await activePool.getConnection();
  try {
    await conn.beginTransaction();
    try {
      await conn.execute(
        `INSERT INTO coupon_code_registry (code, kind, created_at) VALUES (?, 'TRIAL', NOW(6))`,
        [params.code]
      );
    } catch (error: any) {
      if (error?.code === "ER_DUP_ENTRY") {
        const dup = new Error(`Coupon code ${params.code} already exists`);
        (dup as any).code = "DUPLICATE";
        throw dup;
      }
      if (error?.code !== "ER_NO_SUCH_TABLE") {
        throw error;
      }
    }
    try {
      await conn.execute(
        `
        INSERT INTO trial_coupons
          (id, code, max_redemptions, percent_off, expires_at, active, note, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, NOW(6), NOW(6))
      `,
        [
          id,
          params.code,
          params.maxRedemptions,
          params.percentOff,
          toMysqlUtcDateTime(params.expiresAt),
          params.note,
          params.createdBy,
        ]
      );
    } catch (error: any) {
      if (error?.code === "ER_DUP_ENTRY") {
        const dup = new Error(`Coupon code ${params.code} already exists`);
        (dup as any).code = "DUPLICATE";
        throw dup;
      }
      throw error;
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
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
    percentOff?: number;
    expiresAt?: Date;
  }
): Promise<number> {
  const sets: string[] = [];
  const values: (string | number | Date | null)[] = [];

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
  if (updates.percentOff !== undefined) {
    sets.push("percent_off = ?");
    values.push(updates.percentOff);
  }
  if (updates.expiresAt !== undefined) {
    const expiresAt = updates.expiresAt;
    sets.push("expires_at = ?");
    values.push(toMysqlUtcDateTime(expiresAt));
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

const REDEMPTION_CURRENCY_SQL = `(
  SELECT b.currency
  FROM billing_orders b
  WHERE b.user_id = x.user_id
    AND (x.coupon_code IS NULL OR b.coupon_code <=> x.coupon_code)
  ORDER BY b.created_at DESC
  LIMIT 1
)`;

function mapCouponRedemptionRow(r: any): CouponRedemptionRow {
  return {
    id: r.id,
    user_id: r.user_id,
    user_email: r.user_email ?? null,
    user_name: r.user_name ?? null,
    coupon_code: r.coupon_code,
    kind: r.kind === "CREATOR" || r.kind === "PRO" ? r.kind : "TRIAL",
    payable_cents: r.payable_cents == null ? null : Number(r.payable_cents),
    currency:
      typeof r.currency === "string" && r.currency.trim()
        ? r.currency.trim().toUpperCase()
        : null,
    redeemed_at: new Date(r.redeemed_at),
  };
}

/**
 * Recent coupon redemptions for the control panel (who used which code).
 */
export async function listRecentCouponRedemptions(
  limit = 25
): Promise<CouponRedemptionRow[]> {
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const unionSql = `
        SELECT
          r.id,
          r.user_id,
          r.coupon_code,
          'TRIAL' AS kind,
          r.payable_cents,
          r.redeemed_at,
          u.email AS user_email,
          u.name AS user_name
        FROM coupon_redemptions r
        LEFT JOIN users u ON u.id = r.user_id
        UNION ALL
        SELECT
          p.id,
          p.user_id,
          p.coupon_code,
          p.plan AS kind,
          p.payable_cents,
          p.redeemed_at,
          u.email AS user_email,
          u.name AS user_name
        FROM plan_coupon_redemptions p
        LEFT JOIN users u ON u.id = p.user_id
  `;
  try {
    const [rows] = await pool.execute<any[]>(
      `
      SELECT x.*, ${REDEMPTION_CURRENCY_SQL} AS currency
      FROM (${unionSql}) x
      ORDER BY x.redeemed_at DESC
      LIMIT ${safeLimit}
    `
    );
    return rows.map(mapCouponRedemptionRow);
  } catch (error: any) {
    if (error.code === "ER_BAD_FIELD_ERROR" || error.code === "ER_NO_SUCH_TABLE") {
      try {
        const [rows] = await pool.execute<any[]>(
          `
          SELECT * FROM (${unionSql}) x
          ORDER BY x.redeemed_at DESC
          LIMIT ${safeLimit}
        `
        );
        return rows.map(mapCouponRedemptionRow);
      } catch (inner: any) {
        if (inner.code === "ER_NO_SUCH_TABLE" || inner.code === "ER_BAD_FIELD_ERROR") {
          return listTrialOnlyRedemptions(safeLimit);
        }
        throw inner;
      }
    }
    throw error;
  }
}

async function listTrialOnlyRedemptions(safeLimit: number): Promise<CouponRedemptionRow[]> {
  try {
    const [rows] = await pool.execute<any[]>(
      `
      SELECT
        r.id,
        r.user_id,
        r.coupon_code,
        r.payable_cents,
        r.redeemed_at,
        u.email AS user_email,
        u.name AS user_name,
        (
          SELECT b.currency
          FROM billing_orders b
          WHERE b.user_id = r.user_id
            AND (r.coupon_code IS NULL OR b.coupon_code <=> r.coupon_code)
          ORDER BY b.created_at DESC
          LIMIT 1
        ) AS currency
      FROM coupon_redemptions r
      LEFT JOIN users u ON u.id = r.user_id
      ORDER BY r.redeemed_at DESC
      LIMIT ${safeLimit}
    `
    );
    return rows.map((r) => mapCouponRedemptionRow({ ...r, kind: "TRIAL" }));
  } catch (error: any) {
    if (error.code !== "ER_NO_SUCH_TABLE" && error.code !== "ER_BAD_FIELD_ERROR") {
      throw error;
    }
    try {
      const [rows] = await pool.execute<any[]>(
        `
        SELECT
          r.id,
          r.user_id,
          r.coupon_code,
          r.payable_cents,
          r.redeemed_at,
          u.email AS user_email,
          u.name AS user_name
        FROM coupon_redemptions r
        LEFT JOIN users u ON u.id = r.user_id
        ORDER BY r.redeemed_at DESC
        LIMIT ${safeLimit}
      `
      );
      return rows.map((r) => mapCouponRedemptionRow({ ...r, kind: "TRIAL" }));
    } catch (inner: any) {
      if (inner.code === "ER_NO_SUCH_TABLE") return [];
      if (inner.code === "ER_BAD_FIELD_ERROR") {
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
        return rows.map((r) =>
          mapCouponRedemptionRow({ ...r, kind: "TRIAL", payable_cents: 0, currency: null })
        );
      }
      throw inner;
    }
  }
}

function mapPlanCouponRow(r: any): PlanCouponRow {
  return {
    id: r.id,
    code: r.code,
    plan: r.plan === "PRO" ? "PRO" : "CREATOR",
    percent_off: Number(r.percent_off),
    max_redemptions: r.max_redemptions == null ? null : Number(r.max_redemptions),
    expires_at: parseMysqlUtcDate(r.expires_at) ?? new Date(0),
    active: Boolean(r.active),
    note: r.note ?? null,
    created_by: r.created_by ?? null,
    created_at: new Date(r.created_at),
    updated_at: new Date(r.updated_at),
    redeemed_count: Number(r.redeemed_count ?? 0),
  };
}

export async function listPlanCoupons(): Promise<PlanCouponRow[]> {
  try {
    const [rows] = await pool.execute<any[]>(
      `
      SELECT
        pc.id,
        pc.code,
        pc.plan,
        pc.percent_off,
        pc.max_redemptions,
        pc.expires_at,
        pc.active,
        pc.note,
        pc.created_by,
        pc.created_at,
        pc.updated_at,
        COALESCE(cu.redeemed_count, 0) AS redeemed_count
      FROM plan_coupons pc
      LEFT JOIN coupon_usage cu ON cu.coupon_code = pc.code
      ORDER BY pc.created_at DESC
    `
    );
    return rows.map(mapPlanCouponRow);
  } catch (error: any) {
    if (error.code === "ER_NO_SUCH_TABLE") return [];
    throw error;
  }
}

export async function planCouponSchemaAvailable(): Promise<boolean> {
  try {
    await pool.execute(`SELECT 1 FROM plan_coupons LIMIT 1`);
    return true;
  } catch (error: any) {
    if (error.code === "ER_NO_SUCH_TABLE") return false;
    throw error;
  }
}

export async function getPlanCouponByCode(code: string): Promise<PlanCouponRow | null> {
  const [rows] = await pool.execute<any[]>(
    `
    SELECT
      pc.id,
      pc.code,
      pc.plan,
      pc.percent_off,
      pc.max_redemptions,
      pc.expires_at,
      pc.active,
      pc.note,
      pc.created_by,
      pc.created_at,
      pc.updated_at,
      COALESCE(cu.redeemed_count, 0) AS redeemed_count
    FROM plan_coupons pc
    LEFT JOIN coupon_usage cu ON cu.coupon_code = pc.code
    WHERE pc.code = ?
    LIMIT 1
  `,
    [code]
  );
  return rows[0] ? mapPlanCouponRow(rows[0]) : null;
}

export async function createPlanCoupon(params: {
  code: string;
  plan: "CREATOR" | "PRO";
  percentOff: number;
  maxRedemptions: number | null;
  expiresAt: Date;
  note: string | null;
  createdBy: string;
}): Promise<PlanCouponRow> {
  const id = crypto.randomUUID();
  const activePool = await getActivePool();
  const conn = await activePool.getConnection();
  try {
    await conn.beginTransaction();
    try {
      await conn.execute(
        `INSERT INTO coupon_code_registry (code, kind, created_at) VALUES (?, ?, NOW(6))`,
        [params.code, params.plan]
      );
    } catch (error: any) {
      if (error?.code === "ER_DUP_ENTRY") {
        const dup = new Error(`Coupon code ${params.code} already exists`);
        (dup as any).code = "DUPLICATE";
        throw dup;
      }
      throw error;
    }
    try {
      await conn.execute(
        `
        INSERT INTO plan_coupons
          (id, code, plan, percent_off, max_redemptions, expires_at, active, note, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, NOW(6), NOW(6))
      `,
        [
          id,
          params.code,
          params.plan,
          params.percentOff,
          params.maxRedemptions,
          toMysqlUtcDateTime(params.expiresAt),
          params.note,
          params.createdBy,
        ]
      );
    } catch (error: any) {
      if (error?.code === "ER_DUP_ENTRY") {
        const dup = new Error(`Coupon code ${params.code} already exists`);
        (dup as any).code = "DUPLICATE";
        throw dup;
      }
      throw error;
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  const created = await getPlanCouponByCode(params.code);
  if (!created) {
    throw new Error("Failed to load created plan coupon");
  }
  return created;
}

export async function updatePlanCoupon(
  id: string,
  updates: {
    maxRedemptions?: number | null;
    note?: string | null;
    active?: boolean;
    expiresAt?: Date;
    percentOff?: number;
  }
): Promise<number> {
  const sets: string[] = [];
  const values: (string | number | Date | null)[] = [];

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
  if (updates.expiresAt !== undefined) {
    const expiresAt = updates.expiresAt;
    sets.push("expires_at = ?");
    values.push(toMysqlUtcDateTime(expiresAt));
  }
  if (updates.percentOff !== undefined) {
    sets.push("percent_off = ?");
    values.push(updates.percentOff);
  }
  if (sets.length === 0) return 0;
  sets.push("updated_at = NOW(6)");
  values.push(id);
  const [result] = await pool.execute<any>(
    `UPDATE plan_coupons SET ${sets.join(", ")} WHERE id = ?`,
    values
  );
  return Number(result?.affectedRows ?? 0);
}

export async function setPlanCouponActive(id: string, active: boolean): Promise<number> {
  const [result] = await pool.execute<any>(
    `
    UPDATE plan_coupons
    SET active = ?, updated_at = NOW(6)
    WHERE id = ?
  `,
    [active ? 1 : 0, id]
  );
  return Number(result?.affectedRows ?? 0);
}

export async function registerTrialCouponCode(code: string): Promise<void> {
  try {
    await pool.execute(
      `INSERT INTO coupon_code_registry (code, kind, created_at) VALUES (?, 'TRIAL', NOW(6))`,
      [code]
    );
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") {
      const dup = new Error(`Coupon code ${code} already exists`);
      (dup as any).code = "DUPLICATE";
      throw dup;
    }
    if (error?.code === "ER_NO_SUCH_TABLE") return;
    throw error;
  }
}

function centsToUsd(cents: unknown): number {
  return Number(cents ?? 0) / 100;
}

function paiseToInr(paise: unknown): number {
  return Number(paise ?? 0) / 100;
}

function mapInrCatalog(row: Record<string, unknown>): AdminPlanCatalog["inr"] {
  const fallback = PLAN_CATALOG_USD.inr;
  return {
    trialPrice: paiseToInr(row.trial_price_inr_paise) || fallback.trialPrice,
    CREATOR: {
      monthly: paiseToInr(row.creator_monthly_inr_paise) || fallback.CREATOR.monthly,
      twoMonths: paiseToInr(row.creator_two_month_inr_paise) || fallback.CREATOR.twoMonths,
      threeMonths: paiseToInr(row.creator_three_month_inr_paise) || fallback.CREATOR.threeMonths,
    },
    PRO: {
      monthly: paiseToInr(row.pro_monthly_inr_paise) || fallback.PRO.monthly,
      twoMonths: paiseToInr(row.pro_two_month_inr_paise) || fallback.PRO.twoMonths,
      threeMonths: paiseToInr(row.pro_three_month_inr_paise) || fallback.PRO.threeMonths,
    },
  };
}

function mapBillingPlanSettingsRow(row: Record<string, unknown>): AdminPlanCatalog {
  return {
    currency: "USD",
    trialDays: Number(row.trial_days ?? PLAN_CATALOG_USD.trialDays),
    trialPrice: centsToUsd(row.trial_price_cents) || PLAN_CATALOG_USD.trialPrice,
    CREATOR: {
      monthly: centsToUsd(row.creator_monthly_cents) || PLAN_CATALOG_USD.CREATOR.monthly,
      twoMonths: centsToUsd(row.creator_two_month_cents) || PLAN_CATALOG_USD.CREATOR.twoMonths,
      threeMonths:
        centsToUsd(row.creator_three_month_cents) || PLAN_CATALOG_USD.CREATOR.threeMonths,
    },
    PRO: {
      monthly: centsToUsd(row.pro_monthly_cents) || PLAN_CATALOG_USD.PRO.monthly,
      twoMonths: centsToUsd(row.pro_two_month_cents) || PLAN_CATALOG_USD.PRO.twoMonths,
      threeMonths: centsToUsd(row.pro_three_month_cents) || PLAN_CATALOG_USD.PRO.threeMonths,
    },
    channelsPerPlatform: {
      TRIAL: Number(row.trial_channels_per_platform ?? PLAN_CATALOG_USD.channelsPerPlatform.TRIAL),
      CREATOR: Number(
        row.creator_channels_per_platform ?? PLAN_CATALOG_USD.channelsPerPlatform.CREATOR
      ),
      PRO: Number(row.pro_channels_per_platform ?? PLAN_CATALOG_USD.channelsPerPlatform.PRO),
    },
    inr: mapInrCatalog(row),
  };
}

export async function billingPlanSettingsSchemaAvailable(): Promise<boolean> {
  const activePool = await getActivePool();
  try {
    await activePool.execute(`SELECT 1 FROM billing_plan_settings LIMIT 1`);
    return true;
  } catch (error: unknown) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (code === "ER_NO_SUCH_TABLE") return false;
    throw error;
  }
}

export async function getBillingPlanSettings(): Promise<AdminPlanCatalog> {
  const activePool = await getActivePool();
  try {
    const [rows] = await activePool.execute<any[]>(
      `SELECT * FROM billing_plan_settings WHERE id = 1 LIMIT 1`
    );
    if (!rows[0]) return { ...PLAN_CATALOG_USD };
    return mapBillingPlanSettingsRow(rows[0]);
  } catch (error: any) {
    if (error?.code === "ER_NO_SUCH_TABLE") return { ...PLAN_CATALOG_USD };
    throw error;
  }
}

export async function updateBillingPlanSettings(params: {
  catalog: AdminPlanCatalog;
  updatedBy: string;
}): Promise<void> {
  const { catalog, updatedBy } = params;
  const usdToCents = (n: number) => Math.round(n * 100);
  const inrToPaise = (n: number) => Math.round(n * 100);
  const inr = catalog.inr ?? PLAN_CATALOG_USD.inr;
  const activePool = await getActivePool();
  const [result] = await activePool.execute<any>(
    `
    INSERT INTO billing_plan_settings (
      id,
      trial_days,
      trial_price_cents,
      trial_price_inr_paise,
      creator_monthly_cents,
      creator_two_month_cents,
      creator_three_month_cents,
      creator_monthly_inr_paise,
      creator_two_month_inr_paise,
      creator_three_month_inr_paise,
      pro_monthly_cents,
      pro_two_month_cents,
      pro_three_month_cents,
      pro_monthly_inr_paise,
      pro_two_month_inr_paise,
      pro_three_month_inr_paise,
      trial_channels_per_platform,
      creator_channels_per_platform,
      pro_channels_per_platform,
      updated_at,
      updated_by
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(6), ?)
    ON DUPLICATE KEY UPDATE
      trial_days = VALUES(trial_days),
      trial_price_cents = VALUES(trial_price_cents),
      trial_price_inr_paise = VALUES(trial_price_inr_paise),
      creator_monthly_cents = VALUES(creator_monthly_cents),
      creator_two_month_cents = VALUES(creator_two_month_cents),
      creator_three_month_cents = VALUES(creator_three_month_cents),
      creator_monthly_inr_paise = VALUES(creator_monthly_inr_paise),
      creator_two_month_inr_paise = VALUES(creator_two_month_inr_paise),
      creator_three_month_inr_paise = VALUES(creator_three_month_inr_paise),
      pro_monthly_cents = VALUES(pro_monthly_cents),
      pro_two_month_cents = VALUES(pro_two_month_cents),
      pro_three_month_cents = VALUES(pro_three_month_cents),
      pro_monthly_inr_paise = VALUES(pro_monthly_inr_paise),
      pro_two_month_inr_paise = VALUES(pro_two_month_inr_paise),
      pro_three_month_inr_paise = VALUES(pro_three_month_inr_paise),
      trial_channels_per_platform = VALUES(trial_channels_per_platform),
      creator_channels_per_platform = VALUES(creator_channels_per_platform),
      pro_channels_per_platform = VALUES(pro_channels_per_platform),
      updated_at = NOW(6),
      updated_by = VALUES(updated_by)
    `,
    [
      catalog.trialDays,
      usdToCents(catalog.trialPrice),
      inrToPaise(inr.trialPrice),
      usdToCents(catalog.CREATOR.monthly),
      usdToCents(catalog.CREATOR.twoMonths),
      usdToCents(catalog.CREATOR.threeMonths),
      inrToPaise(inr.CREATOR.monthly),
      inrToPaise(inr.CREATOR.twoMonths),
      inrToPaise(inr.CREATOR.threeMonths),
      usdToCents(catalog.PRO.monthly),
      usdToCents(catalog.PRO.twoMonths),
      usdToCents(catalog.PRO.threeMonths),
      inrToPaise(inr.PRO.monthly),
      inrToPaise(inr.PRO.twoMonths),
      inrToPaise(inr.PRO.threeMonths),
      catalog.channelsPerPlatform.TRIAL,
      catalog.channelsPerPlatform.CREATOR,
      catalog.channelsPerPlatform.PRO,
      updatedBy,
    ]
  );
  void result;
}



