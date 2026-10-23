/**
 * Platform health: what is failing right now and for whom. Read-only.
 * Every query is bounded (LIMIT) and tolerates a missing table, like the overview queries.
 */

import { getPoolForContext } from "./index";

type Ctx = "production" | "staging";

export interface FailedPublish {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string;
  title: string | null;
  error: string | null;
  at: Date;
}

export interface FailingSync {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string;
  provider: string;
  account_name: string | null;
  failures: number;
  error: string | null;
  last_ok: Date | null;
}

export interface FailedPayment {
  id: string;
  user_id: string | null;
  user_email: string | null;
  event_type: string;
  provider: string;
  at: Date;
}

export interface DailyPoint {
  day: string;
  value: number;
}

export interface PlatformHealth {
  failedPublishes: FailedPublish[];
  failingSyncs: FailingSync[];
  failedPayments: FailedPayment[];
  stuckPublishing: number;
}

function clip(text: unknown, max = 180): string | null {
  if (typeof text !== "string" || !text.trim()) return null;
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

async function rows<T>(ctx: Ctx, sql: string): Promise<T[]> {
  try {
    const [r] = await getPoolForContext(ctx).execute<any[]>(sql);
    return r as T[];
  } catch (error: any) {
    if (error?.code === "ER_NO_SUCH_TABLE" || error?.code === "ER_BAD_FIELD_ERROR") return [];
    throw error;
  }
}

export async function getPlatformHealth(ctx: Ctx): Promise<PlatformHealth> {
  const [pub, sync, pay, stuck] = await Promise.all([
    rows<any>(
      ctx,
      `SELECT c.id, c.user_id, u.name, u.email, c.title, c.error_message, c.updated_at
       FROM content c JOIN users u ON u.id = c.user_id
       WHERE (LOWER(c.status) = 'failed' OR c.publish_status = 'FAILED')
         AND c.updated_at >= DATE_SUB(NOW(6), INTERVAL 14 DAY)
       ORDER BY c.updated_at DESC LIMIT 25`
    ),
    rows<any>(
      ctx,
      `SELECT s.id, s.user_id, u.name, u.email, s.provider, s.account_name, s.consecutive_sync_failures,
              s.sync_error, s.last_successful_sync_at
       FROM social_accounts s JOIN users u ON u.id = s.user_id
       WHERE s.is_active = 1 AND s.sync_status = 'FAILED'
       ORDER BY s.consecutive_sync_failures DESC, s.updated_at DESC LIMIT 25`
    ),
    rows<any>(
      ctx,
      `SELECT p.id, p.user_id, u.email, p.event_type, p.provider, p.created_at
       FROM payment_audit_events p LEFT JOIN users u ON u.id = p.user_id
       WHERE UPPER(p.status) IN ('FAILED','FAILURE','ERROR','DECLINED')
         AND p.created_at >= DATE_SUB(NOW(6), INTERVAL 7 DAY)
       ORDER BY p.created_at DESC LIMIT 25`
    ),
    rows<any>(
      ctx,
      `SELECT COUNT(*) AS n FROM content
       WHERE publish_status = 'UPLOADING' AND updated_at < DATE_SUB(NOW(6), INTERVAL 2 HOUR)`
    ),
  ]);

  return {
    failedPublishes: pub.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      user_name: r.name,
      user_email: r.email,
      title: r.title,
      error: clip(r.error_message),
      at: new Date(r.updated_at),
    })),
    failingSyncs: sync.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      user_name: r.name,
      user_email: r.email,
      provider: r.provider,
      account_name: r.account_name,
      failures: Number(r.consecutive_sync_failures ?? 0),
      error: clip(r.sync_error),
      last_ok: r.last_successful_sync_at ? new Date(r.last_successful_sync_at) : null,
    })),
    failedPayments: pay.map((r) => ({
      id: String(r.id),
      user_id: r.user_id,
      user_email: r.email,
      event_type: r.event_type,
      provider: r.provider,
      at: new Date(r.created_at),
    })),
    stuckPublishing: Number(stuck[0]?.n ?? 0),
  };
}

function fillDays(raw: { day: Date | string; n: number }[], days: number): DailyPoint[] {
  const byDay = new Map(raw.map((r) => [new Date(r.day).toISOString().slice(0, 10), Number(r.n)]));
  const out: DailyPoint[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, value: byDay.get(key) ?? 0 });
  }
  return out;
}

/** Daily counts for the dashboard trend charts (UTC days, gaps filled with 0). */
export async function getTrendSeries(ctx: Ctx, days = 30) {
  const [signups, applications, publishes, paid] = await Promise.all([
    rows<any>(ctx, `SELECT DATE(created_at) AS day, COUNT(*) AS n FROM users WHERE created_at >= DATE_SUB(UTC_DATE(), INTERVAL ${days - 1} DAY) GROUP BY day`),
    rows<any>(ctx, `SELECT DATE(beta_application_submitted_at) AS day, COUNT(*) AS n FROM users WHERE beta_application_submitted_at >= DATE_SUB(UTC_DATE(), INTERVAL ${days - 1} DAY) GROUP BY day`),
    rows<any>(ctx, `SELECT DATE(updated_at) AS day, COUNT(*) AS n FROM content WHERE LOWER(status) = 'published' AND updated_at >= DATE_SUB(UTC_DATE(), INTERVAL ${days - 1} DAY) GROUP BY day`),
    rows<any>(
      ctx,
      `SELECT DATE(created_at) AS day, COUNT(*) AS n FROM payment_audit_events
       WHERE UPPER(status) IN ('SUCCESS','SUCCEEDED','PAID','CAPTURED')
         AND event_type IN ('VERIFY_PAYMENT_COMPLETE','WEBHOOK_CHECKOUT_COMPLETE')
         AND created_at >= DATE_SUB(UTC_DATE(), INTERVAL ${days - 1} DAY) GROUP BY day`
    ),
  ]);
  return {
    signups: fillDays(signups, days),
    applications: fillDays(applications, days),
    publishes: fillDays(publishes, days),
    paid: fillDays(paid, days),
  };
}

export interface OpenAlert {
  rule: string;
  severity: "URGENT" | "ATTENTION";
  title: string;
  detail: string;
  since: Date;
  lastEmailed: Date | null;
}

/** Alerts the backend scheduler has opened and not yet resolved (table from migration V91). Null when V91 is not applied. */
export async function getOpenAlerts(ctx: Ctx): Promise<OpenAlert[] | null> {
  try {
    const [r] = await getPoolForContext(ctx).execute<any[]>(
      `SELECT rule_key, severity, title, detail, first_seen_at, last_notified_at
       FROM admin_alert_state WHERE resolved_at IS NULL
       ORDER BY severity = 'URGENT' DESC, first_seen_at ASC LIMIT 50`
    );
    return r.map((x) => ({
      rule: x.rule_key,
      severity: x.severity === "URGENT" ? "URGENT" : "ATTENTION",
      title: x.title,
      detail: x.detail,
      since: new Date(x.first_seen_at),
      lastEmailed: x.last_notified_at ? new Date(x.last_notified_at) : null,
    }));
  } catch (error: any) {
    if (error?.code === "ER_NO_SUCH_TABLE") return null;
    throw error;
  }
}
