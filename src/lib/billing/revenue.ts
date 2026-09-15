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
 * Paid amount from an audit details string for one currency.
 * Returns 0 for missing/invalid amounts, leftover $0 trials, or a different currency.
 * Missing currency is treated as USD (legacy audits).
 */
export function extractPaidUsdAmount(details: string | null | undefined): number {
  return extractPaidAmount(details, "USD");
}

export function extractPaidInrAmount(details: string | null | undefined): number {
  return extractPaidAmount(details, "INR");
}

function extractPaidAmount(
  details: string | null | undefined,
  expected: "USD" | "INR"
): number {
  if (!details) return 0;

  const currency = (extractDetailValue(details, "currency") ?? "USD").toUpperCase();
  if (currency !== expected) return 0;

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
  total_collected_inr: number;
  collected_30d_inr: number;
  paid_checkouts: number;
  paid_checkouts_30d: number;
  paid_checkouts_inr: number;
  paid_checkouts_30d_inr: number;
} {
  const cutoff30d = nowMs - 30 * 24 * 60 * 60 * 1000;
  let totalCollectedUsd = 0;
  let collected30dUsd = 0;
  let totalCollectedInr = 0;
  let collected30dInr = 0;
  let paidCheckoutsUsd = 0;
  let paidCheckouts30dUsd = 0;
  let paidCheckoutsInr = 0;
  let paidCheckouts30dInr = 0;

  for (const row of dedupePaymentRevenueRows(rows)) {
    const usd = extractPaidUsdAmount(row.details);
    const inr = extractPaidInrAmount(row.details);
    if (usd <= 0 && inr <= 0) continue;

    const created = new Date(row.created_at).getTime();
    const in30d = Number.isFinite(created) && created >= cutoff30d;

    if (inr > 0) {
      paidCheckoutsInr += 1;
      totalCollectedInr += inr;
      if (in30d) {
        paidCheckouts30dInr += 1;
        collected30dInr += inr;
      }
      continue;
    }

    paidCheckoutsUsd += 1;
    totalCollectedUsd += usd;
    if (in30d) {
      paidCheckouts30dUsd += 1;
      collected30dUsd += usd;
    }
  }

  return {
    total_collected_usd: roundMoney(totalCollectedUsd),
    collected_30d_usd: roundMoney(collected30dUsd),
    total_collected_inr: roundMoney(totalCollectedInr),
    collected_30d_inr: roundMoney(collected30dInr),
    paid_checkouts: paidCheckoutsUsd,
    paid_checkouts_30d: paidCheckouts30dUsd,
    paid_checkouts_inr: paidCheckoutsInr,
    paid_checkouts_30d_inr: paidCheckouts30dInr,
  };
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}
