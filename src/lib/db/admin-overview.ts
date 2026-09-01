/**
 * Admin Overview — single cached payload for the founder home.
 *
 * Architecture (plugio-admin talks to MySQL directly; no Spring overview API):
 * - One server function: getAdminOverview(dbContext)
 * - DB-side aggregates only (no large row dumps to Node)
 * - Next.js Data Cache: revalidate 60s + tag "admin-overview"
 * - Mutations call invalidateAdminOverview() so changes show immediately
 *
 * Freshness model:
 * - Static: PLAN_CATALOG_USD (in-process constants)
 * - Cached (~60s): users, billing, social, content, activity, grants
 * - Near-real-time after admin writes: tag invalidation from server actions
 * - File audit log: cheap local read (not MySQL); not part of DB cache
 */

import { unstable_cache, revalidateTag } from "next/cache";
import { cache } from "react";
import type { Pool } from "mysql2/promise";
import { getPoolForContext } from "./index";
import { toMonthlyUsd } from "@/constants";
import type {
  AdminOverviewPayload,
  BusinessOverview,
  ExpiringGrantRow,
  RecentActivityItem,
} from "@/types";

const OVERVIEW_TAG = "admin-overview";
/** Aggregates are fine at ~1 minute; mutations invalidate sooner. */
const OVERVIEW_REVALIDATE_SECONDS = 60;

async function safeQueryRows(
  db: Pool,
  sql: string,
  fallback: Record<string, number>
): Promise<Record<string, number>> {
  try {
    const [rows] = await db.execute<any[]>(sql);
    return (rows[0] as Record<string, number>) ?? fallback;
  } catch (error: any) {
    if (error?.code === "ER_NO_SUCH_TABLE") return fallback;
    throw error;
  }
}

async function safeQueryList<T>(
  db: Pool,
  sql: string,
  map: (row: any) => T
): Promise<T[]> {
  try {
    const [rows] = await db.execute<any[]>(sql);
    return (rows as any[]).map(map);
  } catch (error: any) {
    if (error?.code === "ER_NO_SUCH_TABLE") return [];
    throw error;
  }
}

/**
 * Paid USD revenue with payment/order dedupe — entirely in MySQL.
 * Avoids pulling thousands of audit rows into the Node process.
 */
async function queryRevenueAggregates(db: Pool): Promise<{
  total_collected_usd: number;
  collected_30d_usd: number;
  paid_checkouts: number;
  paid_checkouts_30d: number;
}> {
  try {
    const [rows] = await db.execute<any[]>(
      `
      SELECT
        COALESCE(SUM(t.amt), 0) AS total_collected_usd,
        COALESCE(SUM(CASE
          WHEN t.created_at >= DATE_SUB(NOW(6), INTERVAL 30 DAY) THEN t.amt
          ELSE 0 END), 0) AS collected_30d_usd,
        COUNT(*) AS paid_checkouts,
        COALESCE(SUM(CASE
          WHEN t.created_at >= DATE_SUB(NOW(6), INTERVAL 30 DAY) THEN 1
          ELSE 0 END), 0) AS paid_checkouts_30d
      FROM (
        SELECT
          COALESCE(
            NULLIF(payment_id, ''),
            NULLIF(NULLIF(order_id, ''), 'N/A'),
            id
          ) AS dedupe_key,
          MAX(created_at) AS created_at,
          MAX(
            CAST(
              SUBSTRING_INDEX(
                SUBSTRING_INDEX(CONCAT(details, ','), 'amount=', -1),
                ',',
                1
              ) AS DECIMAL(12, 2)
            )
          ) AS amt
        FROM payment_audit_events
        WHERE UPPER(status) IN ('SUCCESS', 'SUCCEEDED', 'PAID', 'CAPTURED')
          AND event_type IN (
            'VERIFY_PAYMENT_COMPLETE',
            'WEBHOOK_CHECKOUT_COMPLETE',
            'MOCK_SUBSCRIPTION_ACTIVATED'
          )
          AND details IS NOT NULL
          AND details LIKE '%amount=%'
          AND details NOT LIKE '%mode=TRIAL%'
          AND (
            details LIKE '%currency=USD%'
            OR details NOT LIKE '%currency=%'
          )
        GROUP BY dedupe_key
      ) t
      WHERE t.amt > 0
    `
    );
    const row = rows[0] ?? {};
    return {
      total_collected_usd: Number(row.total_collected_usd ?? 0),
      collected_30d_usd: Number(row.collected_30d_usd ?? 0),
      paid_checkouts: Number(row.paid_checkouts ?? 0),
      paid_checkouts_30d: Number(row.paid_checkouts_30d ?? 0),
    };
  } catch (error: any) {
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return {
        total_collected_usd: 0,
        collected_30d_usd: 0,
        paid_checkouts: 0,
        paid_checkouts_30d: 0,
      };
    }
    throw error;
  }
}

async function loadOverviewMetrics(
  dbContext: "production" | "staging"
): Promise<AdminOverviewPayload> {
  const db = getPoolForContext(dbContext);
  const [
    accessRow,
    subRows,
    grants,
    coupons,
    redeems,
    failures,
    social,
    content,
    activation,
    revenue,
    activity,
    expiringGrants,
  ] = await Promise.all([
    // 1) Users + missing subscription rows (one scan)
    safeQueryRows(
      db,
      `
      SELECT
        COUNT(*) AS total_users,
        SUM(CASE WHEN u.access_status = 'APPROVED'
                  AND u.beta_approved = 1
                  AND u.is_whitelisted = 1
             THEN 1 ELSE 0 END) AS approved_users,
        SUM(CASE WHEN u.access_status = 'PENDING' THEN 1 ELSE 0 END) AS pending_requests,
        SUM(CASE WHEN u.access_status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected_users,
        SUM(CASE WHEN u.created_at >= DATE_SUB(NOW(6), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS new_last_7_days,
        SUM(CASE WHEN s.user_id IS NULL THEN 1 ELSE 0 END) AS users_without_sub
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id
    `,
      {
        total_users: 0,
        approved_users: 0,
        pending_requests: 0,
        rejected_users: 0,
        new_last_7_days: 0,
        users_without_sub: 0,
      }
    ),

    // 2) Subscriptions — small GROUP BY feeds plan mix + MRR
    safeQueryList<{
      subscription_status: string | null;
      plan_id: string | null;
      billing_interval: string | null;
      cnt: number;
    }>(
      db,
      `
      SELECT
        subscription_status,
        plan_id,
        billing_interval,
        COUNT(*) AS cnt
      FROM subscriptions
      GROUP BY subscription_status, plan_id, billing_interval
    `,
      (r) => ({
        subscription_status: r.subscription_status ?? null,
        plan_id: r.plan_id ?? null,
        billing_interval: r.billing_interval ?? null,
        cnt: Number(r.cnt ?? 0),
      })
    ),

    // 3) Grants
    safeQueryRows(
      db,
      `
      SELECT
        SUM(CASE
              WHEN status = 'ACTIVE'
               AND starts_at <= NOW(6)
               AND ends_at > NOW(6)
              THEN 1 ELSE 0 END) AS active_grants,
        SUM(CASE
              WHEN status = 'ACTIVE'
               AND ends_at > NOW(6)
               AND ends_at <= DATE_ADD(NOW(6), INTERVAL 7 DAY)
              THEN 1 ELSE 0 END) AS expiring_7d
      FROM admin_access_grants
    `,
      { active_grants: 0, expiring_7d: 0 }
    ),

    // 4–5) Coupons
    safeQueryRows(
      db,
      `
      SELECT SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active_codes
      FROM trial_coupons
    `,
      { active_codes: 0 }
    ),
    safeQueryRows(
      db,
      `
      SELECT COUNT(*) AS redemptions_7d
      FROM coupon_redemptions
      WHERE redeemed_at >= DATE_SUB(NOW(6), INTERVAL 7 DAY)
    `,
      { redemptions_7d: 0 }
    ),

    // 6) Payment failures (count only)
    safeQueryRows(
      db,
      `
      SELECT COUNT(*) AS failed_7d
      FROM payment_audit_events
      WHERE created_at >= DATE_SUB(NOW(6), INTERVAL 7 DAY)
        AND UPPER(status) IN ('FAILED', 'FAILURE', 'ERROR', 'DECLINED')
    `,
      { failed_7d: 0 }
    ),

    // 7) Social
    safeQueryRows(
      db,
      `
      SELECT
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_accounts,
        COUNT(DISTINCT CASE WHEN is_active = 1 THEN user_id END) AS users_connected,
        SUM(CASE WHEN is_active = 1 AND provider = 'YOUTUBE' THEN 1 ELSE 0 END) AS youtube,
        SUM(CASE WHEN is_active = 1 AND provider = 'INSTAGRAM' THEN 1 ELSE 0 END) AS instagram,
        SUM(CASE WHEN is_active = 1 AND provider = 'FACEBOOK' THEN 1 ELSE 0 END) AS facebook,
        SUM(CASE WHEN is_active = 1 AND sync_status = 'FAILED' THEN 1 ELSE 0 END) AS sync_failed,
        SUM(CASE WHEN is_active = 1 AND sync_status = 'SYNCING' THEN 1 ELSE 0 END) AS syncing
      FROM social_accounts
    `,
      {
        active_accounts: 0,
        users_connected: 0,
        youtube: 0,
        instagram: 0,
        facebook: 0,
        sync_failed: 0,
        syncing: 0,
      }
    ),

    // 8) Content
    safeQueryRows(
      db,
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN LOWER(status) = 'published' THEN 1 ELSE 0 END) AS published,
        SUM(CASE WHEN LOWER(status) = 'scheduled' THEN 1 ELSE 0 END) AS scheduled,
        SUM(CASE WHEN LOWER(status) = 'failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN LOWER(status) IN ('draft', 'ready') THEN 1 ELSE 0 END) AS drafts,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(6), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS created_7d,
        COUNT(DISTINCT user_id) AS creators_with_content
      FROM content
    `,
      {
        total: 0,
        published: 0,
        scheduled: 0,
        failed: 0,
        drafts: 0,
        created_7d: 0,
        creators_with_content: 0,
      }
    ),

    // 9) Activation
    safeQueryRows(
      db,
      `
      SELECT COUNT(DISTINCT u.id) AS approved_with_social
      FROM users u
      INNER JOIN social_accounts s
        ON s.user_id = u.id AND s.is_active = 1
      WHERE u.access_status = 'APPROVED'
        AND u.beta_approved = 1
        AND u.is_whitelisted = 1
    `,
      { approved_with_social: 0 }
    ),

    // 10) Revenue (deduped aggregates)
    queryRevenueAggregates(db),

    // 11) Recent activity (bounded UNION — feed only)
    loadRecentActivity(db, 8),

    // 12) Expiring grants list (bounded)
    loadExpiringGrants(db, 5),
  ]);

  let activeCreator = 0;
  let activePro = 0;
  let trialing = 0;
  let expired = 0;
  let noneStatus = 0;
  let estimatedMrr = 0;

  for (const row of subRows) {
    const status = (row.subscription_status ?? "").toUpperCase();
    const cnt = row.cnt;

    if (status === "ACTIVE" && row.plan_id === "CREATOR") {
      activeCreator += cnt;
      estimatedMrr += toMonthlyUsd("CREATOR", row.billing_interval) * cnt;
    } else if (status === "ACTIVE" && row.plan_id === "PRO") {
      activePro += cnt;
      estimatedMrr += toMonthlyUsd("PRO", row.billing_interval) * cnt;
    } else if (status === "TRIALING") {
      trialing += cnt;
    } else if (status === "EXPIRED") {
      expired += cnt;
    } else if (status === "NONE" || !status) {
      noneStatus += cnt;
    }
  }

  const syncFailed = Number(social.sync_failed ?? 0);
  const contentFailed = Number(content.failed ?? 0);

  const metrics: BusinessOverview = {
    access: {
      total_users: Number(accessRow.total_users ?? 0),
      approved_users: Number(accessRow.approved_users ?? 0),
      pending_requests: Number(accessRow.pending_requests ?? 0),
      rejected_users: Number(accessRow.rejected_users ?? 0),
      new_last_7_days: Number(accessRow.new_last_7_days ?? 0),
    },
    revenue: {
      ...revenue,
      estimated_mrr_usd: Math.round(estimatedMrr * 100) / 100,
    },
    plans: {
      active_creator: activeCreator,
      active_pro: activePro,
      trialing,
      complimentary_grants: Number(grants.active_grants ?? 0),
      expired,
      none: noneStatus + Number(accessRow.users_without_sub ?? 0),
    },
    coupons: {
      active_codes: Number(coupons.active_codes ?? 0),
      redemptions_7d: Number(redeems.redemptions_7d ?? 0),
    },
    social: {
      active_accounts: Number(social.active_accounts ?? 0),
      users_connected: Number(social.users_connected ?? 0),
      youtube: Number(social.youtube ?? 0),
      instagram: Number(social.instagram ?? 0),
      facebook: Number(social.facebook ?? 0),
      sync_failed: syncFailed,
      syncing: Number(social.syncing ?? 0),
    },
    content: {
      total: Number(content.total ?? 0),
      published: Number(content.published ?? 0),
      scheduled: Number(content.scheduled ?? 0),
      failed: contentFailed,
      drafts: Number(content.drafts ?? 0),
      created_7d: Number(content.created_7d ?? 0),
      creators_with_content: Number(content.creators_with_content ?? 0),
    },
    activation: {
      approved_with_social: Number(activation.approved_with_social ?? 0),
    },
    attention: {
      pending_beta: Number(accessRow.pending_requests ?? 0),
      payment_failures_7d: Number(failures.failed_7d ?? 0),
      grants_expiring_7d: Number(grants.expiring_7d ?? 0),
      sync_failed: syncFailed,
      content_failed: contentFailed,
    },
  };

  return {
    metrics,
    activity,
    expiringGrants,
    generatedAt: new Date().toISOString(),
  };
}

async function loadRecentActivity(db: Pool, limit: number): Promise<RecentActivityItem[]> {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 20);
  try {
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
  } catch {
    return [];
  }
}

async function loadExpiringGrants(db: Pool, limit: number): Promise<ExpiringGrantRow[]> {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 20);
  return safeQueryList(
    db,
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
  `,
    (r) => ({
      id: r.id,
      user_id: r.user_id,
      user_email: r.user_email ?? null,
      user_name: r.user_name ?? null,
      plan_id: r.plan_id,
      ends_at: new Date(r.ends_at),
      duration_days: Number(r.duration_days),
    })
  );
}

/**
 * Single entry point for Admin Overview.
 * Deduped per-request via React cache; cross-request via Next data cache.
 */
export const getAdminOverview = unstable_cache(
  cache(async (dbContext: "production" | "staging"): Promise<AdminOverviewPayload> => {
    return loadOverviewMetrics(dbContext);
  }),
  ["admin-overview-v3"],
  {
    revalidate: OVERVIEW_REVALIDATE_SECONDS,
    tags: [OVERVIEW_TAG, "dashboard"],
  }
);

/** Call from mutating server actions so Overview refreshes without waiting TTL. */
export function invalidateAdminOverview(): void {
  revalidateTag(OVERVIEW_TAG);
  revalidateTag("dashboard");
  revalidateTag("users");
  revalidateTag("beta");
  revalidateTag("billing");
  revalidateTag("coupons");
  revalidateTag("grants");
  revalidateTag("payments");
}
