import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { IDS, seed } from "./seed.ts";
import { getMarketplacePulse, listBookings, getBookingCounts, listInquiries, getInquiryStats, getCreatorMarketplace } from "../../src/lib/db/marketplace.ts";
import { getPlatformHealth, getTrendSeries, getOpenAlerts } from "../../src/lib/db/health.ts";
import {
  getUsers, getUserDetail, searchUsersQuick, getBetaRequests, getGlobalPaymentAuditEvents, getPendingBetaCount,
} from "../../src/lib/db/queries.ts";
import { getAdminOverview } from "../../src/lib/db/admin-overview.ts";
import { getFunnel, getRevenueSeries, getRetention } from "../../src/lib/db/growth.ts";
import { addCreatorNote, listCreatorNotes, deleteCreatorNote } from "../../src/lib/db/notes.ts";
import { readRecentAuditLogs } from "../../src/lib/logger/index.ts";
import { connect } from "./seed.ts";
import { prodPool, stagingPool } from "../../src/lib/db/index.ts";

before(async () => {
  await seed();
});

// Open pools keep Node alive; close them so a finished (or failed) run exits.
after(async () => {
  await Promise.allSettled([prodPool.end(), stagingPool.end()]);
});

describe("marketplace", () => {
  it("pulse totals each currency separately and counts the stuck refund", async () => {
    const p = await getMarketplacePulse();
    const inr = p.store.find((r) => r.currency === "INR");
    const usd = p.store.find((r) => r.currency === "USD");
    assert.deepEqual([inr?.count, inr?.grossMinor, inr?.feeMinor], [1, 49900, 4990]);
    assert.deepEqual([usd?.count, usd?.grossMinor, usd?.feeMinor], [1, 1500, 150]);
    assert.equal(p.sessions.find((r) => r.currency === "INR")?.count, 1);
    assert.equal(p.upcomingSessions, 4);
    assert.equal(p.refundPending, 1);
    assert.equal(p.activeSellers30d, 1);
  });

  it("booking filters pick the right sessions", async () => {
    const upcoming = await listBookings("UPCOMING", "", 1);
    assert.equal(upcoming.total, 4);
    const attention = await listBookings("NEEDS_ATTENTION", "", 1);
    // refund stuck + unpaid for over a day + meeting link failed
    assert.equal(attention.total, 3);
    assert.deepEqual(new Set(attention.items.map((b) => b.payment_status)), new Set(["REFUND_PENDING", "PENDING", "FREE"]));
    assert.equal((await listBookings("CANCELLED", "", 1)).total, 3);
    assert.equal((await listBookings("ALL", "", 1)).total, 7);
    assert.equal((await listBookings("ALL", "asha", 1)).total, 7, "search by creator name");
    assert.equal((await listBookings("ALL", "nobody-here", 1)).total, 0);
    const first = upcoming.items[0];
    assert.equal(first.creator_id, IDS.creatorA);
    assert.equal(first.session_title, "Portfolio review");
  });

  it("search text is escaped, not treated as a pattern", async () => {
    assert.equal((await listBookings("ALL", "%", 1)).total, 0);
  });

  it("flags a creator who cancelled three paid sessions", async () => {
    const c = await getBookingCounts();
    assert.equal(c.upcoming, 4);
    assert.equal(c.needsAttention, 3);
    assert.equal(c.cancelled30d, 3);
    assert.deepEqual(c.repeatCancellers.map((r) => [r.creator_id, r.n]), [[IDS.creatorA, 3]]);
  });

  it("lists inquiries, unread first filter and stats", async () => {
    assert.equal((await listInquiries(false, "", 1)).total, 2);
    const unread = await listInquiries(true, "", 1);
    assert.equal(unread.total, 1);
    assert.equal(unread.items[0].brand, "Acme");
    assert.equal((await listInquiries(false, "acme", 1)).total, 1);
    assert.deepEqual(await getInquiryStats(), { total: 2, unread: 1, last7d: 1 });
  });

  it("creator 360 gathers store, sessions, kyc and payouts", async () => {
    const m = await getCreatorMarketplace(IDS.creatorA);
    assert.equal(m.storeTotal.length, 2);
    assert.deepEqual(m.products, { total: 1, live: 1, suspended: 0 });
    assert.deepEqual(m.bookings, { upcoming: 4, completed: 0, cancelled: 3, cancelledByCreator90d: 3 });
    assert.deepEqual(m.inquiries, { total: 2, unread: 1 });
    assert.equal(m.kyc?.status, "PENDING");
    assert.deepEqual(m.payouts, { requestedCount: 1, requestedMinor: 40000, paidMinor: 0 });
    const empty = await getCreatorMarketplace(IDS.applicantB);
    assert.equal(empty.kyc, null);
    assert.equal(empty.storeTotal.length, 0);
  });
});

describe("platform health", () => {
  it("lists failures with who is affected", async () => {
    const h = await getPlatformHealth("production");
    assert.equal(h.failedPublishes.length, 1);
    assert.equal(h.failedPublishes[0].error, "Instagram rejected the video");
    assert.equal(h.failedPublishes[0].user_id, IDS.creatorA);
    assert.equal(h.failingSyncs.length, 1);
    assert.equal(h.failingSyncs[0].failures, 4);
    assert.equal(h.failedPayments.length, 1);
    assert.equal(h.stuckPublishing, 1);
  });

  it("trend series fills every day and counts the seed", async () => {
    const t = await getTrendSeries("production", 30);
    for (const series of [t.signups, t.applications, t.publishes, t.paid]) assert.equal(series.length, 30);
    const sum = (s: { value: number }[]) => s.reduce((n, p) => n + p.value, 0);
    assert.equal(sum(t.signups), 2, "the 40-day-old user is outside the 30-day window");
    assert.equal(sum(t.applications), 2);
    assert.equal(sum(t.publishes), 1);
    assert.equal(sum(t.paid), 1);
  });
});

describe("creators and access queries", () => {
  it("users list: filters, sorts and counts channels and published posts", async () => {
    const all = await getUsers("", "ALL", 1, 20, "joined", "desc");
    assert.equal(all.total, 3);
    const asha = all.items.find((u) => u.id === IDS.creatorA);
    assert.equal(asha?.channels, 1);
    assert.equal(asha?.published, 1);
    assert.equal((await getUsers("", "PAID", 1)).total, 1);
    assert.equal((await getUsers("bilal", "ALL", 1)).total, 1);
    for (const sort of ["joined", "name", "channels", "published"] as const) {
      for (const dir of ["asc", "desc"] as const) {
        assert.equal((await getUsers("", "ALL", 1, 20, sort, dir)).items.length, 3, `${sort} ${dir}`);
      }
    }
    for (const filter of ["APPROVED_NO_TRIAL", "TRIAL_NO_PUBLISH", "TRIAL_ENDING", "TRIALING", "FREE"] as const) {
      await getUsers("", filter, 1);
    }
  });

  it("quick search finds by name, email fragment and exact id", async () => {
    assert.equal((await searchUsersQuick("asha")).length, 1);
    assert.equal((await searchUsersQuick("example.com")).length, 3);
    assert.equal((await searchUsersQuick(IDS.rejectedC)).length, 1);
  });

  it("beta queue and counts", async () => {
    const pending = await getBetaRequests("PENDING", "", 1, 20);
    assert.deepEqual(pending.items.map((r) => r.id), [IDS.applicantB]);
    assert.equal(await getPendingBetaCount("production"), 1);
  });

  it("user detail and payment audit list load", async () => {
    const d = await getUserDetail(IDS.creatorA);
    assert.equal(d?.published_count, 2, "published plus scheduled");
    assert.equal(d?.social_accounts.length, 1);
    const pay = await getGlobalPaymentAuditEvents(1, 50);
    assert.equal(pay.total, 2);
  });

  it("founder overview aggregates", async () => {
    const o = await getAdminOverview("production");
    assert.equal(o.metrics.access.total_users, 3);
    assert.equal(o.metrics.access.pending_requests, 1);
    assert.equal(o.metrics.content.failed, 1);
    assert.equal(o.metrics.attention.payment_failures_7d, 1);
    assert.equal(o.metrics.social.sync_failed, 1);
    assert.equal(o.metrics.plans.active_creator, 1);
    assert.equal(o.metrics.plans.trialing, 1);
  });
});

describe("growth", () => {
  it("funnel counts each step once", async () => {
    const f = Object.fromEntries((await getFunnel()).map((s) => [s.key, s.count]));
    assert.deepEqual(f, { signed_in: 3, applied: 2, approved: 1, connected: 1, published: 1, trial_started: 2, paid: 1 });
  });

  it("revenue is per currency and ignores unpaid checkouts", async () => {
    const r = await getRevenueSeries(30);
    const usd = r.find((s) => s.currency === "USD");
    const inr = r.find((s) => s.currency === "INR");
    assert.deepEqual([usd?.totalMinor, usd?.orders], [2700, 1]);
    assert.deepEqual([inr?.totalMinor, inr?.orders], [99900, 1]);
    assert.equal(usd?.points.length, 30);
  });

  it("retention separates paying, trialing and ending trials", async () => {
    const r = await getRetention();
    assert.equal(r.paying, 1);
    assert.equal(r.trialing, 1);
    assert.equal(r.trialsEnding48h, 1);
    assert.equal(r.expiredTotal, 0);
  });
});

describe("notes and audit trail", () => {
  it("adds, lists and deletes notes with author rules", async () => {
    await addCreatorNote(IDS.creatorA, "ops@example.com", "Called, will publish on Friday");
    const notes = await listCreatorNotes(IDS.creatorA);
    assert.equal(notes?.length, 1);
    assert.equal(notes?.[0].author_email, "ops@example.com");
    const id = notes![0].id;
    assert.equal(await deleteCreatorNote(id, "someone-else@example.com", false), false, "not the author");
    assert.equal(await deleteCreatorNote(id, "someone-else@example.com", true), true, "super admin may delete any");
    assert.equal((await listCreatorNotes(IDS.creatorA))?.length, 0);
  });

  it("audit trail reads from the database, newest first", async () => {
    const db = await connect();
    await db.query(
      `INSERT INTO admin_audit_log (occurred_at, admin_email, action, target_user_id, target_email, details)
       VALUES ('2026-01-01 10:00:00.000000', 'a@x.com', 'BETA_APPROVE', ?, 'a@example.com', 'first'),
              ('2026-01-02 10:00:00.000000', 'b@x.com', 'COUPON_CREATE', NULL, NULL, 'second')`,
      [IDS.creatorA]
    );
    await db.end();
    const logs = await readRecentAuditLogs(10);
    assert.deepEqual(logs.map((l) => l.details), ["second", "first"]);
    assert.equal(logs[1].targetUserId, IDS.creatorA);
    assert.equal(logs[0].timestamp, "2026-01-02T10:00:00.000Z");
  });
});

describe("alerts panel", () => {
  it("lists open alerts urgent first and hides resolved ones", async () => {
    const db = await connect();
    await db.query("DELETE FROM admin_alert_state");
    await db.query(
      `INSERT INTO admin_alert_state (rule_key, subject_key, severity, title, detail, first_seen_at, last_notified_at, resolved_at) VALUES
        ('PAYOUT_WAITING', 'p1', 'ATTENTION', 'Payout waiting 30h', 'INR 400.00', NOW(6), NULL, NULL),
        ('REFUND_STUCK', 'b1', 'URGENT', 'Customer refund stuck 3h', 'INR 300.00', NOW(6), NOW(6), NULL),
        ('DISPUTE_DUE', 'd1', 'URGENT', 'Old one', 'x', NOW(6), NOW(6), NOW(6))`
    );
    await db.end();
    const open = await getOpenAlerts("production");
    assert.deepEqual(open?.map((a) => a.rule), ["REFUND_STUCK", "PAYOUT_WAITING"]);
    assert.equal(open?.[1].lastEmailed, null);
  });
});
