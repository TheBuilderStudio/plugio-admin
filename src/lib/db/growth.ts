/**
 * Founder growth views: signup-to-paid funnel, daily revenue, retention. Read-only.
 * Revenue comes from billing_orders (one row per checkout, FULFILLED when paid), not from payment event text.
 */

import { pool } from "./index";

async function rows<T = any>(sql: string): Promise<T[]> {
  try {
    const [r] = await pool.execute<any[]>(sql);
    return r as T[];
  } catch (error: any) {
    if (error?.code === "ER_NO_SUCH_TABLE" || error?.code === "ER_BAD_FIELD_ERROR") return [];
    throw error;
  }
}

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  /** Where the creators in this step are listed, when a list exists. */
  href?: string;
}

export async function getFunnel(): Promise<FunnelStep[]> {
  const [r] = await rows(`
    SELECT
      (SELECT COUNT(*) FROM users) AS signed_in,
      (SELECT COUNT(*) FROM users WHERE beta_application_submitted_at IS NOT NULL) AS applied,
      (SELECT COUNT(*) FROM users WHERE access_status = 'APPROVED' AND beta_approved = 1 AND is_whitelisted = 1) AS approved,
      (SELECT COUNT(DISTINCT s.user_id) FROM social_accounts s JOIN users u ON u.id = s.user_id
         WHERE s.is_active = 1 AND u.access_status = 'APPROVED') AS connected,
      (SELECT COUNT(DISTINCT c.user_id) FROM content c WHERE LOWER(c.status) IN ('published','scheduled')) AS published,
      (SELECT COUNT(*) FROM subscriptions WHERE subscription_status IN ('TRIALING','ACTIVE') OR has_used_trial = 1) AS trial_started,
      (SELECT COUNT(*) FROM subscriptions WHERE subscription_status = 'ACTIVE' AND plan_id IN ('CREATOR','PRO')) AS paid
  `);
  const n = (k: string) => Number(r?.[k] ?? 0);
  return [
    { key: "signed_in", label: "Signed in", count: n("signed_in"), href: "/admin/users" },
    { key: "applied", label: "Applied for access", count: n("applied"), href: "/admin/beta?status=ALL" },
    { key: "approved", label: "Approved", count: n("approved"), href: "/admin/beta?status=APPROVED" },
    { key: "connected", label: "Connected an account", count: n("connected") },
    { key: "published", label: "Published or scheduled a post", count: n("published") },
    { key: "trial_started", label: "Started a trial", count: n("trial_started"), href: "/admin/users?filter=TRIALING" },
    { key: "paid", label: "Paying", count: n("paid"), href: "/admin/users?filter=PAID" },
  ];
}

export interface RevenuePoint {
  day: string;
  value: number;
}
export interface RevenueSeries {
  currency: string;
  /** Minor units (cents / paise) per day, oldest first, gaps filled with 0. */
  points: RevenuePoint[];
  totalMinor: number;
  orders: number;
}

export async function getRevenueSeries(days = 30): Promise<RevenueSeries[]> {
  const raw = await rows(
    `SELECT DATE(fulfilled_at) AS day, currency, SUM(amount_cents) AS minor, COUNT(*) AS n
     FROM billing_orders
     WHERE status = 'FULFILLED' AND fulfilled_at >= DATE_SUB(UTC_DATE(), INTERVAL ${days - 1} DAY)
     GROUP BY day, currency`
  );
  const currencies = Array.from(new Set(raw.map((r) => String(r.currency))));
  const today = new Date();
  return currencies.map((currency) => {
    const mine = raw.filter((r) => r.currency === currency);
    const byDay = new Map(mine.map((r) => [new Date(r.day).toISOString().slice(0, 10), Number(r.minor)]));
    const points: RevenuePoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
      const key = d.toISOString().slice(0, 10);
      points.push({ day: key, value: byDay.get(key) ?? 0 });
    }
    return {
      currency,
      points,
      totalMinor: mine.reduce((s, r) => s + Number(r.minor), 0),
      orders: mine.reduce((s, r) => s + Number(r.n), 0),
    };
  });
}

export interface Retention {
  paying: number;
  trialing: number;
  trialsEnding48h: number;
  expiredTotal: number;
  /** Paid periods that ended in the last 30 days and were not renewed. */
  lapsed30d: number;
  /** Trials that ended in the last 30 days: how many became paying vs did not. */
  trialsEnded30d: number;
  trialsConverted30d: number;
}

export async function getRetention(): Promise<Retention> {
  const [r] = await rows(`
    SELECT
      SUM(subscription_status = 'ACTIVE' AND plan_id IN ('CREATOR','PRO')) AS paying,
      SUM(subscription_status = 'TRIALING') AS trialing,
      SUM(subscription_status = 'TRIALING' AND trial_ends_at > NOW(6) AND trial_ends_at <= DATE_ADD(NOW(6), INTERVAL 2 DAY)) AS ending,
      SUM(subscription_status = 'EXPIRED') AS expired,
      SUM(subscription_status = 'EXPIRED' AND pro_period_end_at IS NOT NULL AND pro_period_end_at >= DATE_SUB(NOW(6), INTERVAL 30 DAY)) AS lapsed,
      SUM(trial_ends_at IS NOT NULL AND trial_ends_at < NOW(6) AND trial_ends_at >= DATE_SUB(NOW(6), INTERVAL 30 DAY)) AS trials_ended,
      SUM(trial_ends_at IS NOT NULL AND trial_ends_at < NOW(6) AND trial_ends_at >= DATE_SUB(NOW(6), INTERVAL 30 DAY)
          AND subscription_status = 'ACTIVE' AND plan_id IN ('CREATOR','PRO')) AS converted
    FROM subscriptions
  `);
  const n = (k: string) => Number(r?.[k] ?? 0);
  return {
    paying: n("paying"),
    trialing: n("trialing"),
    trialsEnding48h: n("ending"),
    expiredTotal: n("expired"),
    lapsed30d: n("lapsed"),
    trialsEnded30d: n("trials_ended"),
    trialsConverted30d: n("converted"),
  };
}
