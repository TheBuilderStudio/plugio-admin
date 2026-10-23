/**
 * Marketplace read models for the admin: store orders, paid sessions (bookings) and portfolio inquiries.
 * Read-only. Money stays in each row's own currency (minor units) and is never added across currencies.
 */

import { pool } from "./index";
import type { PaginatedResult } from "@/types";

export interface MoneyByCurrency {
  currency: string;
  count: number;
  grossMinor: number;
  feeMinor: number;
}

export interface MarketplacePulse {
  store: MoneyByCurrency[];
  sessions: MoneyByCurrency[];
  upcomingSessions: number;
  refundPending: number;
  activeSellers30d: number;
}

async function rows<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    const [r] = await pool.execute<any[]>(sql, params as any[]);
    return r as T[];
  } catch (error: any) {
    if (error?.code === "ER_NO_SUCH_TABLE" || error?.code === "ER_BAD_FIELD_ERROR") return [];
    throw error;
  }
}

const toMoney = (r: any): MoneyByCurrency => ({
  currency: r.currency,
  count: Number(r.n ?? 0),
  grossMinor: Number(r.gross ?? 0),
  feeMinor: Number(r.fee ?? 0),
});

export async function getMarketplacePulse(): Promise<MarketplacePulse> {
  const [store, sessions, upcoming, refund, sellers] = await Promise.all([
    rows(
      `SELECT currency, COUNT(*) n, SUM(amount_minor) gross, SUM(platform_fee_minor) fee
       FROM store_orders WHERE status = 'PAID' AND paid_at >= DATE_SUB(NOW(6), INTERVAL 30 DAY) GROUP BY currency`
    ),
    rows(
      `SELECT currency, COUNT(*) n, SUM(amount_cents) gross, SUM(platform_fee_cents) fee
       FROM bookings WHERE payment_status = 'PAID' AND paid_at >= DATE_SUB(NOW(6), INTERVAL 30 DAY) GROUP BY currency`
    ),
    rows(`SELECT COUNT(*) n FROM bookings WHERE status = 'UPCOMING' AND slot_start_time >= NOW(6)`),
    rows(`SELECT COUNT(*) n FROM bookings WHERE payment_status = 'REFUND_PENDING'`),
    rows(
      `SELECT COUNT(*) n FROM (
         SELECT seller_user_id AS u FROM store_orders WHERE status = 'PAID' AND paid_at >= DATE_SUB(NOW(6), INTERVAL 30 DAY)
         UNION
         SELECT creator_user_id FROM bookings WHERE payment_status = 'PAID' AND paid_at >= DATE_SUB(NOW(6), INTERVAL 30 DAY)
       ) t`
    ),
  ]);
  return {
    store: store.map(toMoney),
    sessions: sessions.map(toMoney),
    upcomingSessions: Number(upcoming[0]?.n ?? 0),
    refundPending: Number(refund[0]?.n ?? 0),
    activeSellers30d: Number(sellers[0]?.n ?? 0),
  };
}

// ─── Bookings ─────────────────────────────────────────────

export type BookingFilter = "UPCOMING" | "NEEDS_ATTENTION" | "CANCELLED" | "COMPLETED" | "ALL";

export interface BookingRow {
  id: string;
  creator_id: string;
  creator_name: string | null;
  creator_email: string;
  attendee_name: string;
  attendee_email: string;
  session_title: string | null;
  slot_start: Date;
  status: string;
  payment_status: string;
  amount_minor: number;
  currency: string;
  cancelled_by: string | null;
  cancel_reason: string | null;
  meeting_status: string | null;
  meeting_error: string | null;
}

const BOOKING_WHERE: Record<BookingFilter, string> = {
  UPCOMING: "b.status = 'UPCOMING' AND b.slot_start_time >= NOW(6)",
  NEEDS_ATTENTION:
    "(b.payment_status IN ('REFUND_PENDING') OR (b.status = 'UPCOMING' AND b.payment_status = 'PENDING' AND b.created_at < DATE_SUB(NOW(6), INTERVAL 1 DAY)) OR (b.status = 'UPCOMING' AND b.meeting_status IN ('FAILED','UNAVAILABLE') AND b.slot_start_time >= NOW(6)))",
  CANCELLED: "b.status = 'CANCELLED'",
  COMPLETED: "b.status = 'COMPLETED'",
  ALL: "1 = 1",
};

export async function listBookings(
  filter: BookingFilter,
  search: string,
  page: number,
  pageSize = 25
): Promise<PaginatedResult<BookingRow>> {
  const where = BOOKING_WHERE[filter];
  const like = `%${search.replace(/[%_\\]/g, "\\$&")}%`;
  const searchSql = search ? "AND (b.attendee_email LIKE ? OR b.attendee_name LIKE ? OR u.email LIKE ? OR u.name LIKE ?)" : "";
  const params = search ? [like, like, like, like] : [];
  const offset = Math.max(0, (page - 1) * pageSize);
  const order = filter === "UPCOMING" ? "ASC" : "DESC";

  const items = await rows(
    `SELECT b.id, b.creator_user_id, u.name AS creator_name, u.email AS creator_email, b.attendee_name, b.attendee_email,
            st.title AS session_title, b.slot_start_time, b.status, b.payment_status, b.amount_cents, b.currency,
            b.cancelled_by, b.cancel_reason, b.meeting_status, b.meeting_error
     FROM bookings b
     JOIN users u ON u.id = b.creator_user_id
     LEFT JOIN booking_session_types st ON st.id = b.session_type_id
     WHERE ${where} ${searchSql}
     ORDER BY b.slot_start_time ${order}
     LIMIT ${pageSize} OFFSET ${offset}`,
    params
  );
  const count = await rows(
    `SELECT COUNT(*) n FROM bookings b JOIN users u ON u.id = b.creator_user_id WHERE ${where} ${searchSql}`,
    params
  );
  const total = Number(count[0]?.n ?? 0);
  return {
    items: items.map((r) => ({
      id: r.id,
      creator_id: r.creator_user_id,
      creator_name: r.creator_name,
      creator_email: r.creator_email,
      attendee_name: r.attendee_name,
      attendee_email: r.attendee_email,
      session_title: r.session_title,
      slot_start: new Date(r.slot_start_time),
      status: r.status,
      payment_status: r.payment_status,
      amount_minor: Number(r.amount_cents ?? 0),
      currency: r.currency,
      cancelled_by: r.cancelled_by,
      cancel_reason: r.cancel_reason,
      meeting_status: r.meeting_status,
      meeting_error: r.meeting_error,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export interface BookingCounts {
  upcoming: number;
  needsAttention: number;
  cancelled30d: number;
  repeatCancellers: { creator_id: string; name: string | null; email: string; n: number }[];
}

export async function getBookingCounts(): Promise<BookingCounts> {
  const [up, attn, canc, rep] = await Promise.all([
    rows(`SELECT COUNT(*) n FROM bookings b WHERE ${BOOKING_WHERE.UPCOMING}`),
    rows(`SELECT COUNT(*) n FROM bookings b WHERE ${BOOKING_WHERE.NEEDS_ATTENTION}`),
    rows(`SELECT COUNT(*) n FROM bookings WHERE status = 'CANCELLED' AND cancelled_at >= DATE_SUB(NOW(6), INTERVAL 30 DAY)`),
    rows(
      `SELECT b.creator_user_id, u.name, u.email, COUNT(*) n
       FROM bookings b JOIN users u ON u.id = b.creator_user_id
       WHERE b.status = 'CANCELLED' AND b.cancelled_by = 'CREATOR' AND b.cancelled_at >= DATE_SUB(NOW(6), INTERVAL 90 DAY)
       GROUP BY b.creator_user_id, u.name, u.email HAVING n >= 3 ORDER BY n DESC LIMIT 10`
    ),
  ]);
  return {
    upcoming: Number(up[0]?.n ?? 0),
    needsAttention: Number(attn[0]?.n ?? 0),
    cancelled30d: Number(canc[0]?.n ?? 0),
    repeatCancellers: rep.map((r) => ({ creator_id: r.creator_user_id, name: r.name, email: r.email, n: Number(r.n) })),
  };
}

// ─── Inquiries ────────────────────────────────────────────

export interface InquiryRow {
  id: string;
  creator_id: string;
  creator_name: string | null;
  creator_email: string;
  sender_name: string;
  sender_email: string;
  brand: string | null;
  message: string;
  read: boolean;
  created_at: Date;
}

export async function listInquiries(
  unreadOnly: boolean,
  search: string,
  page: number,
  pageSize = 25
): Promise<PaginatedResult<InquiryRow>> {
  const like = `%${search.replace(/[%_\\]/g, "\\$&")}%`;
  const searchSql = search
    ? "AND (i.sender_email LIKE ? OR i.sender_name LIKE ? OR i.brand_company LIKE ? OR u.email LIKE ? OR u.name LIKE ?)"
    : "";
  const params = search ? [like, like, like, like, like] : [];
  const where = `${unreadOnly ? "i.read_at IS NULL" : "1 = 1"} ${searchSql}`;
  const offset = Math.max(0, (page - 1) * pageSize);
  const items = await rows(
    `SELECT i.id, i.creator_user_id, u.name AS creator_name, u.email AS creator_email, i.sender_name, i.sender_email,
            i.brand_company, i.message, i.read_at, i.created_at
     FROM portfolio_inquiries i JOIN users u ON u.id = i.creator_user_id
     WHERE ${where} ORDER BY i.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
    params
  );
  const count = await rows(
    `SELECT COUNT(*) n FROM portfolio_inquiries i JOIN users u ON u.id = i.creator_user_id WHERE ${where}`,
    params
  );
  const total = Number(count[0]?.n ?? 0);
  return {
    items: items.map((r) => ({
      id: r.id,
      creator_id: r.creator_user_id,
      creator_name: r.creator_name,
      creator_email: r.creator_email,
      sender_name: r.sender_name,
      sender_email: r.sender_email,
      brand: r.brand_company,
      message: r.message,
      read: r.read_at != null,
      created_at: new Date(r.created_at),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getInquiryStats(): Promise<{ total: number; unread: number; last7d: number }> {
  const r = await rows(
    `SELECT COUNT(*) total, SUM(read_at IS NULL) unread, SUM(created_at >= DATE_SUB(NOW(6), INTERVAL 7 DAY)) last7d FROM portfolio_inquiries`
  );
  return { total: Number(r[0]?.total ?? 0), unread: Number(r[0]?.unread ?? 0), last7d: Number(r[0]?.last7d ?? 0) };
}

// ─── Creator 360 ──────────────────────────────────────────

export interface CreatorMarketplace {
  store: MoneyByCurrency[];
  storeTotal: MoneyByCurrency[];
  products: { total: number; live: number; suspended: number };
  sessions: MoneyByCurrency[];
  bookings: { upcoming: number; completed: number; cancelled: number; cancelledByCreator90d: number };
  inquiries: { total: number; unread: number };
  kyc: { status: string; submittedAt: Date | null } | null;
  payouts: { requestedCount: number; requestedMinor: number; paidMinor: number };
}

export async function getCreatorMarketplace(userId: string): Promise<CreatorMarketplace> {
  const [store, storeAll, prod, sess, book, inq, kyc, pay] = await Promise.all([
    rows(
      `SELECT currency, COUNT(*) n, SUM(amount_minor) gross, SUM(platform_fee_minor) fee FROM store_orders
       WHERE seller_user_id = ? AND status = 'PAID' AND paid_at >= DATE_SUB(NOW(6), INTERVAL 30 DAY) GROUP BY currency`,
      [userId]
    ),
    rows(
      `SELECT currency, COUNT(*) n, SUM(amount_minor) gross, SUM(platform_fee_minor) fee FROM store_orders
       WHERE seller_user_id = ? AND status = 'PAID' GROUP BY currency`,
      [userId]
    ),
    rows(
      `SELECT COUNT(*) total, SUM(status = 'PUBLISHED') live, SUM(status = 'SUSPENDED') suspended FROM store_products WHERE seller_user_id = ?`,
      [userId]
    ),
    rows(
      `SELECT currency, COUNT(*) n, SUM(amount_cents) gross, SUM(platform_fee_cents) fee FROM bookings
       WHERE creator_user_id = ? AND payment_status = 'PAID' GROUP BY currency`,
      [userId]
    ),
    rows(
      `SELECT SUM(status = 'UPCOMING') upcoming, SUM(status = 'COMPLETED') completed, SUM(status = 'CANCELLED') cancelled,
              SUM(status = 'CANCELLED' AND cancelled_by = 'CREATOR' AND cancelled_at >= DATE_SUB(NOW(6), INTERVAL 90 DAY)) c90
       FROM bookings WHERE creator_user_id = ?`,
      [userId]
    ),
    rows(`SELECT COUNT(*) total, SUM(read_at IS NULL) unread FROM portfolio_inquiries WHERE creator_user_id = ?`, [userId]),
    rows(`SELECT status, submitted_at FROM seller_kyc WHERE seller_user_id = ? LIMIT 1`, [userId]),
    rows(
      `SELECT SUM(status = 'REQUESTED') rc, SUM(CASE WHEN status = 'REQUESTED' THEN amount_minor ELSE 0 END) rm,
              SUM(CASE WHEN status = 'PAID' THEN amount_minor ELSE 0 END) pm
       FROM store_payout_requests WHERE seller_user_id = ?`,
      [userId]
    ),
  ]);
  return {
    store: store.map(toMoney),
    storeTotal: storeAll.map(toMoney),
    products: { total: Number(prod[0]?.total ?? 0), live: Number(prod[0]?.live ?? 0), suspended: Number(prod[0]?.suspended ?? 0) },
    sessions: sess.map(toMoney),
    bookings: {
      upcoming: Number(book[0]?.upcoming ?? 0),
      completed: Number(book[0]?.completed ?? 0),
      cancelled: Number(book[0]?.cancelled ?? 0),
      cancelledByCreator90d: Number(book[0]?.c90 ?? 0),
    },
    inquiries: { total: Number(inq[0]?.total ?? 0), unread: Number(inq[0]?.unread ?? 0) },
    kyc: kyc[0] ? { status: kyc[0].status, submittedAt: kyc[0].submitted_at ? new Date(kyc[0].submitted_at) : null } : null,
    payouts: {
      requestedCount: Number(pay[0]?.rc ?? 0),
      requestedMinor: Number(pay[0]?.rm ?? 0),
      paidMinor: Number(pay[0]?.pm ?? 0),
    },
  };
}
