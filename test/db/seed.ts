/**
 * Seed for the query tests. Small, but every state the admin queries branch on appears at least once.
 * Runs against a THROWAWAY MySQL started by scripts/query-tests.sh, never a real database.
 */
import mysql from "mysql2/promise";

export const IDS = {
  creatorA: "00000000-0000-4000-8000-00000000000a",
  applicantB: "00000000-0000-4000-8000-00000000000b",
  rejectedC: "00000000-0000-4000-8000-00000000000c",
  sessionType: "00000000-0000-4000-8000-0000000000e1",
  product: "00000000-0000-4000-8000-0000000000f1",
};

const TABLES = [
  "admin_audit_log", "admin_alert_state", "admin_creator_notes", "billing_orders",
  "portfolio_inquiries", "store_payout_requests", "store_orders", "store_products", "seller_kyc", "bookings",
  "booking_session_types", "payment_audit_events", "content", "social_accounts", "subscriptions", "users",
];

export async function connect() {
  const { DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, DB_PASSWORD } = process.env;
  if (DB_HOST !== "127.0.0.1" || !DB_NAME?.includes("test")) {
    // Refuse to wipe anything that does not look like the throwaway database.
    throw new Error("query tests only run against the throwaway test database (use `npm run test:db`)");
  }
  return mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USERNAME,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: false,
  });
}

export async function seed() {
  const db = await connect();
  await db.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const t of TABLES) await db.query(`DELETE FROM ${t}`);
  await db.query("SET FOREIGN_KEY_CHECKS = 1");

  const now = "NOW(6)";
  const ago = (interval: string) => `DATE_SUB(NOW(6), INTERVAL ${interval})`;
  const run = (sql: string, params: unknown[] = []) => db.query(sql, params);

  // users: A approved creator, B pending applicant, C rejected
  await run(
    `INSERT INTO users (id, google_id, email, name, access_status, beta_approved, is_whitelisted, created_at, updated_at,
                        beta_application_submitted_at, instagram_username)
     VALUES (?, 'g-a', 'a@example.com', 'Asha Creator', 'APPROVED', 1, 1, ${ago("20 DAY")}, ${now}, ${ago("21 DAY")}, 'asha'),
            (?, 'g-b', 'b@example.com', 'Bilal Applicant', 'PENDING', 0, 0, ${ago("2 DAY")}, ${now}, ${ago("2 DAY")}, 'bilal'),
            (?, 'g-c', 'c@example.com', 'Chitra Declined', 'REJECTED', 0, 0, ${ago("40 DAY")}, ${now}, NULL, NULL)`,
    [IDS.creatorA, IDS.applicantB, IDS.rejectedC]
  );

  await run(
    `INSERT INTO subscriptions (id, user_id, subscription_status, plan_id, billing_interval, created_at, updated_at)
     VALUES (UUID(), ?, 'ACTIVE', 'CREATOR', 'MONTHLY', ${ago("10 DAY")}, ${now})`,
    [IDS.creatorA]
  );

  // B is on a trial that ends tomorrow
  await run(
    `INSERT INTO subscriptions (id, user_id, subscription_status, plan_id, billing_interval, trial_ends_at, has_used_trial, created_at, updated_at)
     VALUES (UUID(), ?, 'TRIALING', 'TRIAL', 'MONTHLY', DATE_ADD(NOW(6), INTERVAL 1 DAY), 1, ${ago("3 DAY")}, ${now})`,
    [IDS.applicantB]
  );

  // two paid checkouts, in two currencies, and one that was never paid
  await run(
    `INSERT INTO billing_orders (id, user_id, provider, external_order_id, checkout_mode, billing_interval, amount_cents, currency, status, fulfilled_at, created_at, updated_at)
     VALUES (UUID(), ?, 'razorpay', 'order_usd_1', 'CREATOR', 'MONTHLY', 2700, 'USD', 'FULFILLED', ${ago("2 DAY")}, ${ago("2 DAY")}, ${now}),
            (UUID(), ?, 'razorpay', 'order_inr_1', 'CREATOR', 'MONTHLY', 99900, 'INR', 'FULFILLED', ${now}, ${now}, ${now}),
            (UUID(), ?, 'razorpay', 'order_open_1', 'PRO', 'MONTHLY', 5900, 'USD', 'CREATED', NULL, ${now}, ${now})`,
    [IDS.creatorA, IDS.creatorA, IDS.applicantB]
  );

  await run(
    `INSERT INTO social_accounts (id, user_id, provider, provider_user_id, account_name, is_active, sync_status,
                                  consecutive_sync_failures, sync_error, created_at, updated_at)
     VALUES (UUID(), ?, 'YOUTUBE', 'yt-1', 'Asha TV', 1, 'FAILED', 4, 'token revoked', ${ago("5 DAY")}, ${now})`,
    [IDS.creatorA]
  );

  // content: one published today, one failed with an error, one stuck uploading for 3 hours
  await run(
    `INSERT INTO content (id, user_id, title, media_url, content_type, status, publish_status, error_message, created_at, updated_at)
     VALUES (UUID(), ?, 'Good post', 'https://x/1.mp4', 'video', 'published', 'SUCCESS', NULL, ${ago("1 DAY")}, ${now}),
            (UUID(), ?, 'Broken post', 'https://x/2.mp4', 'video', 'failed', 'FAILED', 'Instagram rejected the video', ${ago("1 DAY")}, ${now}),
            (UUID(), ?, 'Stuck post', 'https://x/3.mp4', 'video', 'scheduled', 'UPLOADING', NULL, ${ago("1 DAY")}, ${ago("3 HOUR")})`,
    [IDS.creatorA, IDS.creatorA, IDS.creatorA]
  );

  await run(
    `INSERT INTO payment_audit_events (id, user_id, provider, event_type, status, details, created_at)
     VALUES (UUID(), ?, 'RAZORPAY', 'VERIFY_PAYMENT_COMPLETE', 'SUCCESS', 'amount=27.00,currency=USD', ${ago("1 DAY")}),
            (UUID(), ?, 'RAZORPAY', 'VERIFY_PAYMENT_COMPLETE', 'FAILED', 'card declined', ${ago("1 DAY")})`,
    [IDS.creatorA, IDS.creatorA]
  );

  // bookings
  await run(
    `INSERT INTO booking_session_types (id, creator_user_id, title, created_at, updated_at)
     VALUES (?, ?, 'Portfolio review', ${now}, ${now})`,
    [IDS.sessionType, IDS.creatorA]
  );
  const booking = (
    status: string, pay: string, amount: number, start: string, extra: Record<string, unknown> = {}
  ) => {
    const cols = ["id", "creator_user_id", "session_type_id", "attendee_name", "attendee_email", "slot_start_time",
      "slot_end_time", "timezone", "status", "payment_status", "amount_cents", "currency", "platform_fee_cents",
      "created_at", "updated_at", ...Object.keys(extra)];
    const vals = ["UUID()", "?", "?", "'Customer'", "'cust@example.com'", start, `DATE_ADD(${start}, INTERVAL 30 MINUTE)`,
      "'Asia/Kolkata'", "?", "?", "?", "'INR'", "?", ago("2 DAY"), now, ...Object.keys(extra).map(() => "?")];
    return run(`INSERT INTO bookings (${cols.join(",")}) VALUES (${vals.join(",")})`, [
      IDS.creatorA, IDS.sessionType, status, pay, amount, Math.round(amount * 0.1), ...Object.values(extra),
    ]);
  };
  await booking("UPCOMING", "PAID", 50000, "DATE_ADD(NOW(6), INTERVAL 2 DAY)", { paid_at: new Date() });
  await booking("UPCOMING", "REFUND_PENDING", 30000, "DATE_ADD(NOW(6), INTERVAL 3 DAY)");
  await booking("UPCOMING", "PENDING", 20000, "DATE_ADD(NOW(6), INTERVAL 4 DAY)");
  await run(`UPDATE bookings SET created_at = ${ago("3 DAY")} WHERE payment_status = 'PENDING'`);
  await booking("UPCOMING", "FREE", 0, "DATE_ADD(NOW(6), INTERVAL 5 DAY)", { meeting_status: "FAILED", meeting_error: "calendar disconnected" });
  for (let i = 0; i < 3; i++) {
    await booking("CANCELLED", "REFUNDED", 10000, `DATE_SUB(NOW(6), INTERVAL ${5 + i} DAY)`, {
      cancelled_at: new Date(), cancelled_by: "CREATOR", cancel_reason: "sick",
    });
  }

  await run(
    `INSERT INTO portfolio_inquiries (id, creator_user_id, sender_name, sender_email, brand_company, message, read_at, created_at)
     VALUES (UUID(), ?, 'Brand Rep', 'rep@brand.com', 'Acme', 'Collab?', NULL, ${ago("1 DAY")}),
            (UUID(), ?, 'Other Rep', 'other@brand.com', NULL, 'Hello', ${now}, ${ago("9 DAY")})`,
    [IDS.creatorA, IDS.creatorA]
  );

  // store: one product, two paid orders (one INR, one USD), one payout request, KYC pending
  await run(
    `INSERT INTO store_products (id, seller_user_id, slug, title, price_minor, status, created_at, updated_at)
     VALUES (?, ?, 'preset-pack', 'Preset pack', 49900, 'PUBLISHED', ${now}, ${now})`,
    [IDS.product, IDS.creatorA]
  );
  const order = (currency: string, amount: number, fee: number) =>
    run(
      `INSERT INTO store_orders (id, public_token, product_id, seller_user_id, product_title, product_slug, buyer_email,
                                 amount_minor, platform_fee_minor, seller_net_minor, currency, status, paid_at, created_at, updated_at)
       VALUES (UUID(), UUID(), ?, ?, 'Preset pack', 'preset-pack', 'buyer@example.com', ?, ?, ?, ?, 'PAID', ${now}, ${now}, ${now})`,
      [IDS.product, IDS.creatorA, amount, fee, amount - fee, currency]
    );
  await order("INR", 49900, 4990);
  await order("USD", 1500, 150);
  await run(
    `INSERT INTO store_payout_requests (id, seller_user_id, amount_minor, status, destination, requested_at)
     VALUES (UUID(), ?, 40000, 'REQUESTED', 'upi:asha@bank', ${now})`,
    [IDS.creatorA]
  );
  await run(
    `INSERT INTO seller_kyc (seller_user_id, status, legal_name, pan, submitted_at, updated_at)
     VALUES (?, 'PENDING', 'Asha Creator', 'enc-pan', ${now}, ${now})`,
    [IDS.creatorA]
  );

  await db.end();
}
