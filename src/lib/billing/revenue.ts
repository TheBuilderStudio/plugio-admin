/**
 * Pure helpers for admin revenue math.
 * Audit `details` format (backend invoiceAuditDetails):
 *   mode=PRO, interval=MONTHLY, coupon=none, amount=15.00, currency=USD
 */

export function extractDetailValue(
  details: string | null | undefined,
  key: string
): string | null {
  if (!details) return null;
  const match = details.match(new RegExp(`(?:^|,\\s*)${key}=([^,]+)`, "i"));
  if (!match) return null;
  const value = match[1]?.trim();
  return value ? value : null;
}

/**
 * Paid USD amount from an audit details string.
 * Returns 0 for trials, missing/invalid amounts, or non-USD currencies
 * (do not mix currencies into a USD revenue total).
 */
export function extractPaidUsdAmount(details: string | null | undefined): number {
  if (!details) return 0;

  const mode = extractDetailValue(details, "mode");
  if (mode && mode.toUpperCase() === "TRIAL") return 0;

  const currency = (extractDetailValue(details, "currency") ?? "USD").toUpperCase();
  if (currency !== "USD") return 0;

  const raw = extractDetailValue(details, "amount");
  if (!raw) return 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value;
}

export type PaymentRevenueRow = {
  id: string;
  payment_id: string | null;
  order_id: string | null;
  event_key: string | null;
  details: string | null;
  created_at: Date | string;
};

/**
 * Deduplicate payment audits that share the same Razorpay payment/order
 * (e.g. webhook + verify both SUCCESS with amount). Prefer payment_id, then
 * order_id, then event_key, then row id.
 */
export function dedupePaymentRevenueRows(
  rows: PaymentRevenueRow[]
): PaymentRevenueRow[] {
  const seen = new Set<string>();
  const out: PaymentRevenueRow[] = [];

  for (const row of rows) {
    const key =
      (row.payment_id && `pay:${row.payment_id}`) ||
      (row.order_id && `ord:${row.order_id}`) ||
      (row.event_key && `evt:${row.event_key}`) ||
      `id:${row.id}`;

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out;
}

export function sumPaidUsdRevenue(
  rows: PaymentRevenueRow[],
  nowMs = Date.now()
): {
  total_collected_usd: number;
  collected_30d_usd: number;
  paid_checkouts: number;
  paid_checkouts_30d: number;
} {
  const cutoff30d = nowMs - 30 * 24 * 60 * 60 * 1000;
  let totalCollected = 0;
  let collected30d = 0;
  let paidCheckouts = 0;
  let paidCheckouts30d = 0;

  for (const row of dedupePaymentRevenueRows(rows)) {
    const amount = extractPaidUsdAmount(row.details);
    if (amount <= 0) continue;

    paidCheckouts += 1;
    totalCollected += amount;

    const created = new Date(row.created_at).getTime();
    if (Number.isFinite(created) && created >= cutoff30d) {
      paidCheckouts30d += 1;
      collected30d += amount;
    }
  }

  return {
    total_collected_usd: roundMoney(totalCollected),
    collected_30d_usd: roundMoney(collected30d),
    paid_checkouts: paidCheckouts,
    paid_checkouts_30d: paidCheckouts30d,
  };
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}
