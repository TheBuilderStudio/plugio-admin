import "server-only";

import { getActiveDbContext } from "@/lib/db";
import { AdminAuthConfigError, adminAuthHeaders } from "@/lib/admin-token";
import { resolveBackendUrl } from "@/lib/backend-url";

/**
 * Server-to-server client for the Plugio backend's admin store API.
 * Authenticated with ADMIN_API_KEY; the acting admin's email is sent for the backend audit trail.
 */

export interface StorePage<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

export interface StorePayout {
  id: string;
  sellerId: string;
  sellerName: string | null;
  sellerEmail: string | null;
  amountMinor: number;
  currency: string;
  status: "REQUESTED" | "PAID" | "REJECTED";
  destination: string;
  reference: string | null;
  note: string | null;
  processedBy: string | null;
  requestedAt: string;
  processedAt: string | null;
  /** The seller's withdrawable balance right now; negative means they owe money after refunds or disputes. */
  sellerAvailableMinor: number;
}

export interface StoreKyc {
  sellerId: string;
  sellerName: string | null;
  sellerEmail: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  legalName: string;
  pan: string;
  payoutHolder: string | null;
  payoutDestination: string | null;
  /** True when the PAN name and the payout account holder are the same ignoring case and punctuation. */
  nameMatchesPayout: boolean;
  /** Another creator with a pending or approved verification uses the same PAN. */
  duplicatePan: boolean;
  rejectReason: string | null;
  reviewedBy: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

export interface StoreSettlementBatch {
  id: string;
  status: "OPEN" | "SETTLED" | "CANCELLED";
  payoutCount: number;
  totalMinor: number;
  currency: string;
  bankReference: string | null;
  createdBy: string;
  createdAt: string;
  closedBy: string | null;
  closedAt: string | null;
  /** Set once the bank file was downloaded; the bank may have paid it from then on. */
  exportedAt: string | null;
  cancelReason: string | null;
}

export interface StoreDiscrepancy {
  kind: string;
  subjectId: string;
  sellerId: string | null;
  expectedMinor: number | null;
  actualMinor: number | null;
  detail: string;
}

export interface StoreReconciliation {
  generatedAt: string;
  ledgerTotalMinor: number;
  owedToCreatorsMinor: number;
  requestedPayoutsMinor: number;
  paidPayoutsMinor: number;
  balanced: boolean;
  discrepancies: StoreDiscrepancy[];
}

export interface StoreOrder {
  id: string;
  productTitle: string;
  sellerId: string;
  sellerName: string | null;
  buyerEmail: string;
  amountMinor: number;
  platformFeeMinor: number;
  /** What the creator was charged for the payment gateway on this order. */
  gatewayFeeMinor?: number;
  /** What Razorpay actually charged Plugio (GST included). Only meaningful when actualGatewayFeeKnown. */
  actualGatewayFeeMinor?: number;
  actualGatewayFeeKnown?: boolean;
  currency: string;
  status: string;
  paidAt: string | null;
}

export interface StoreProduct {
  id: string;
  title: string;
  slug: string;
  sellerId: string;
  sellerName: string | null;
  sellerUsername: string | null;
  priceMinor: number;
  salesCount: number;
  viewCount: number;
  status: string;
  suspendedReason: string | null;
  createdAt: string;
}

/** A refund or dispute recorded from the payment gateway (nothing has been moved; the amount is held). */
export interface PaymentExceptionRow {
  id: string;
  type: "GATEWAY_REFUND" | "DISPUTE" | "PAID_SESSION_CANCELLED";
  gatewayRef: string;
  paymentId: string | null;
  subjectKind: "STORE" | "BOOKING" | "SUBSCRIPTION" | "UNKNOWN";
  subjectId: string | null;
  sellerId: string | null;
  amountMinor: number;
  currency: string;
  gatewayStatus: string | null;
  phase: string | null;
  reasonCode: string | null;
  respondBy: string | null;
  plugioInitiated: boolean;
  state: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";
  holdActive: boolean;
  resolution: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  /** What the customer paid, when different from the held amount. */
  grossMinor: number | null;
  /** Cancelled-session items: paid sessions this creator cancelled in the last 90 days (this one included). */
  creatorCancellations90d: number | null;
  /** Cancelled with less than 24 hours' notice. */
  lateCancellation: boolean;
}

/** Where one seller's money is, and every movement. */
export interface SellerBreakdown {
  lifetimeEarnedMinor: number;
  paidOutMinor: number;
  requestedMinor: number;
  otherAdjustmentsMinor: number;
  ledgerBalanceMinor: number;
  availableMinor: number;
  pendingMinor: number;
  heldMinor: number;
  owedMinor: number;
  reconciles: boolean;
  holdDays?: number;
  grossSalesMinor?: number;
  platformFeeMinor?: number;
  /** Payment gateway charge the creator paid, net of charges returned on refunds. */
  gatewayFeeMinor?: number;
  refundedMinor?: number;
}

export interface SellerStatementRow {
  id: string;
  type: string;
  label: string;
  description: string | null;
  amountMinor: number;
  balanceAfterMinor: number;
  createdAt: string;
  availableAt: string;
  availableNow: boolean;
  payoutId: string | null;
  payoutStatus: string | null;
  payoutReference: string | null;
  source?: "STORE" | "BOOKING" | null;
}

export interface SellerStatement {
  sellerId: string;
  sellerName: string | null;
  sellerEmail: string | null;
  currency: string;
  breakdown: SellerBreakdown;
  page: { rows: SellerStatementRow[]; page: number; size: number; total: number; totalPages: number };
}

export interface PayoutSettings {
  minPayoutMinor: number;
  withdrawAllFloorMinor: number;
  version: number;
  updatedBy: string | null;
  updatedAt: string | null;
}

/** The two commission policies (the only two) and the version an update must be based on. */
export interface CommissionPolicy {
  digitalProductsFeePercent: number;
  bookingsFeePercent: number;
  /** Payment gateway (Razorpay) charge, GST included, paid by the creator on top of the fee above. 0 = none. */
  gatewayFeePercent?: number;
  version: number;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface AdminTransaction {
  kind: "STORE" | "BOOKING" | "SUBSCRIPTION";
  id: string;
  at: string | null;
  partyId: string | null;
  partyName: string | null;
  partyEmail: string | null;
  counterpartyEmail: string | null;
  description: string | null;
  status: string;
  currency: string;
  grossMinor: number;
  feeMinor: number;
  gatewayFeeMinor?: number;
  netMinor: number;
  gatewayPaymentId: string | null;
}

export interface RevenueRow {
  kind: string;
  currency: string;
  status: string;
  count: number;
  grossMinor: number;
  feeMinor: number;
  gatewayFeeMinor?: number;
  netMinor: number;
}

export interface CommissionRow {
  sellerId: string;
  sellerName: string | null;
  sellerEmail: string | null;
  kind: string;
  currency: string;
  count: number;
  grossMinor: number;
  feeMinor: number;
  gatewayFeeMinor?: number;
  netMinor: number;
}

export interface PayoutSummaryRow {
  status: string;
  currency: string;
  count: number;
  totalMinor: number;
}

export interface ReportRange {
  from: string;
  to: string;
}

export interface TransactionFilter {
  kind?: string;
  status?: string;
  from?: string;
  to?: string;
  q?: string;
}

function query(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export class StoreApiError extends Error {}

async function resolveBackendConfig(): Promise<{ backend: string; apiKey?: string }> {
  const isStaging = (await getActiveDbContext()) === "staging";
  const backend = resolveBackendUrl(isStaging);
  if (!backend) {
    throw new StoreApiError("BACKEND_API_URL is not configured.");
  }
  // The shared key is only needed in legacy mode; adminAuthHeaders refuses to run with neither key nor signing key.
  const apiKey = isStaging ? process.env.STAGING_ADMIN_API_KEY || process.env.ADMIN_API_KEY : process.env.ADMIN_API_KEY;
  return { backend, apiKey };
}

function authHeaders(actor: string, method: string, path: string, apiKey?: string): Record<string, string> {
  try {
    return adminAuthHeaders({ actor, method, path, apiKey });
  } catch (err) {
    if (err instanceof AdminAuthConfigError) throw new StoreApiError(err.message);
    throw err;
  }
}

async function call<T>(
  actor: string,
  path: string,
  init?: { method?: string; body?: unknown },
  base = "/api/admin/store",
): Promise<T> {
  const { backend, apiKey } = await resolveBackendConfig();

  const method = init?.method ?? "GET";
  const urlPath = `${base}${path}`;
  // Signed identity (when a signing key is configured); the backend binds it to this method and path.
  const auth = authHeaders(actor, method, urlPath.split("?")[0], apiKey);

  let res: Response;
  try {
    res = await fetch(`${backend}${urlPath}`, {
      method,
      headers: {
        ...auth,
        Accept: "application/json",
        ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    throw new StoreApiError(`Could not reach backend (${backend}): ${message}`);
  }

  const json = (await res.json().catch(() => null)) as { data?: T; message?: string } | null;
  if (!res.ok) {
    if (res.status === 401) {
      if (json?.message === "Authentication required") {
        throw new StoreApiError(
          `Store operations are not available on this backend (${backend}). If you are testing, please switch the Database toggle to Staging.`
        );
      }
      throw new StoreApiError(json?.message || "Invalid or unauthorized admin API key");
    }
    if (res.status === 403) {
      throw new StoreApiError("Access denied. You do not have permission for this action.");
    }
    throw new StoreApiError(json?.message || `Backend request failed (${res.status})`);
  }
  return json?.data as T;
}

async function fetchCsv(actor: string, urlPathWithQuery: string, what: string): Promise<string> {
  const { backend, apiKey } = await resolveBackendConfig();
  const urlPath = urlPathWithQuery.split("?")[0];
  const auth = authHeaders(actor, "GET", urlPath, apiKey);
  const res = await fetch(`${backend}${urlPathWithQuery}`, {
    headers: { ...auth, Accept: "text/csv" },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new StoreApiError(res.status === 403 ? `You do not have permission to export ${what}.` : `Export failed (${res.status})`);
  return res.text();
}

// ───────────────────────── money: where every rupee goes ─────────────────────────

export type MoneySource = "STORE" | "BOOKING";

/** gross - refunded - gatewayCharged - platformFee = creatorNet. Charges are net of what refunds gave back. */
export interface MoneyTotals {
  saleCount: number;
  grossMinor: number;
  refundedMinor: number;
  gatewayChargedMinor: number;
  platformFeeMinor: number;
  creatorNetMinor: number;
}

export interface MoneyGatewayActual {
  /** What Razorpay actually charged Plugio, GST included. */
  actualFeeMinor: number;
  actualTaxMinor: number;
  paymentsWithFee: number;
  paymentsWithoutFee: number;
  /** What creators were charged for the gateway. */
  chargedToCreatorsMinor: number;
  /** Positive: creators paid more than Razorpay charged. Negative: Plugio is covering the difference. */
  marginMinor: number;
  /** False while some payments have no Razorpay fee yet; the margin is then only partial. */
  complete: boolean;
}

export interface MoneyOverview {
  from: string;
  to: string;
  currency: string;
  source: MoneySource | null;
  total: MoneyTotals;
  store: MoneyTotals;
  booking: MoneyTotals;
  gateway: MoneyGatewayActual;
  /** Plugio fee plus the gateway margin. */
  plugioIncomeMinor: number;
  plugioIncomeComplete: boolean;
  payouts: { paidMinor: number; paidCount: number; inReviewMinor: number; inReviewCount: number; rejectedMinor: number };
  liabilities: { creatorBalancesMinor: number; creatorsWithBalance: number; negativeBalancesMinor: number; withdrawalsInReviewMinor: number };
}

export interface MoneyCreatorRow {
  sellerId: string;
  name: string | null;
  email: string | null;
  saleCount: number;
  grossMinor: number;
  refundedMinor: number;
  gatewayChargedMinor: number;
  platformFeeMinor: number;
  creatorNetMinor: number;
  paidOutMinor: number;
  inReviewMinor: number;
  balanceNowMinor: number;
}

export interface MoneyCreatorPage {
  rows: MoneyCreatorRow[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

export const storeApi = {
  moneyOverview: (actor: string, range: { from?: string; to?: string }, source?: MoneySource) =>
    call<MoneyOverview>(actor, `/money/overview${query({ ...range, source })}`),
  moneyCreators: (actor: string, range: { from?: string; to?: string }, source: MoneySource | undefined, page: number) =>
    call<MoneyCreatorPage>(actor, `/money/creators${query({ ...range, source, page, size: 50 })}`),
  moneyCreatorsCsv: (actor: string, range: { from?: string; to?: string }, source?: MoneySource): Promise<string> =>
    fetchCsv(actor, `/api/admin/store/money/creators/csv${query({ ...range, source })}`, "money by creator"),
  commissionPolicy: (actor: string) => call<CommissionPolicy>(actor, "/monetization"),
  updateCommissionPolicy: (actor: string, body: { digitalProductsFeePercent: number; bookingsFeePercent: number; gatewayFeePercent: number; version: number }) =>
    call<CommissionPolicy>(actor, "/monetization", { method: "PUT", body }),
  payouts: (actor: string, status: string, page: number) =>
    call<StorePage<StorePayout>>(actor, `/payouts?status=${encodeURIComponent(status)}&page=${page}`),
  markPaid: (actor: string, id: string, reference: string) =>
    call<StorePayout>(actor, `/payouts/${encodeURIComponent(id)}/paid`, { method: "POST", body: { reference } }),
  rejectPayout: (actor: string, id: string, reason: string) =>
    call<StorePayout>(actor, `/payouts/${encodeURIComponent(id)}/reject`, { method: "POST", body: { reason } }),
  kyc: (actor: string, status: string, page: number) =>
    call<StorePage<StoreKyc>>(actor, `/kyc?status=${encodeURIComponent(status)}&page=${page}`),
  approveKyc: (actor: string, sellerId: string) =>
    call<StoreKyc>(actor, `/kyc/${encodeURIComponent(sellerId)}/approve`, { method: "POST", body: {} }),
  rejectKyc: (actor: string, sellerId: string, reason: string) =>
    call<StoreKyc>(actor, `/kyc/${encodeURIComponent(sellerId)}/reject`, { method: "POST", body: { reason } }),
  settlements: (actor: string, page: number) => call<StorePage<StoreSettlementBatch>>(actor, `/settlements?page=${page}`),
  createSettlement: (actor: string) => call<StoreSettlementBatch>(actor, "/settlements", { method: "POST", body: {} }),
  settleBatch: (actor: string, id: string, reference: string) =>
    call<StoreSettlementBatch>(actor, `/settlements/${encodeURIComponent(id)}/settle`, { method: "POST", body: { reference } }),
  cancelBatch: (actor: string, id: string, reason: string) =>
    call<StoreSettlementBatch>(actor, `/settlements/${encodeURIComponent(id)}/cancel`, { method: "POST", body: { reason } }),
  reconciliation: (actor: string) => call<StoreReconciliation>(actor, "/reconciliation"),
  /** The bank file for a batch, as CSV text. */
  settlementCsv: (actor: string, id: string): Promise<string> =>
    fetchCsv(actor, `/api/admin/store/settlements/${encodeURIComponent(id)}/csv`, "settlements"),
  transactions: (actor: string, filter: TransactionFilter, page: number) =>
    call<StorePage<AdminTransaction>>(actor, `/transactions${query({ ...filter, page, size: 50 })}`),
  revenueReport: (actor: string, range: { from?: string; to?: string }) =>
    call<{ from: string; to: string; rows: RevenueRow[] }>(actor, `/reports/revenue${query(range)}`),
  commissionReport: (actor: string, range: { from?: string; to?: string }) =>
    call<{ from: string; to: string; rows: CommissionRow[] }>(actor, `/reports/commission${query(range)}`),
  payoutReport: (actor: string, range: { from?: string; to?: string }) =>
    call<{ from: string; to: string; rows: PayoutSummaryRow[] }>(actor, `/reports/payouts${query(range)}`),
  /** CSV text for one of: transactions, revenue, commission, payouts. */
  reportCsv: (actor: string, name: "transactions" | "revenue" | "commission" | "payouts", params: TransactionFilter): Promise<string> =>
    fetchCsv(actor, name === "transactions" ? `/api/admin/store/transactions/csv${query({ ...params })}`
      : `/api/admin/store/reports/${name}/csv${query({ from: params.from, to: params.to })}`, name),
  exceptions: (actor: string, activeOnly: boolean, page: number) =>
    call<StorePage<PaymentExceptionRow>>(actor, `/exceptions?activeOnly=${activeOnly}&page=${page}`),
  dismissException: (actor: string, id: string, reason: string) =>
    call<PaymentExceptionRow>(actor, `/exceptions/${encodeURIComponent(id)}/dismiss`, { method: "POST", body: { reason } }),
  sellerStatement: (actor: string, sellerId: string, page: number, source?: "STORE" | "BOOKING") =>
    call<SellerStatement>(
      actor,
      `/sellers/${encodeURIComponent(sellerId)}/statement?page=${page}&size=50${source ? `&source=${source}` : ""}`
    ),
  /** Approves the full refund of a paid session the creator cancelled (customer 100%, creator share debited, fee returned). */
  refundCancelledSession: (actor: string, id: string) =>
    call<{ result: "REFUNDED" | "IN_PROGRESS"; item: PaymentExceptionRow }>(
      actor, `/exceptions/${encodeURIComponent(id)}/refund-session`, { method: "POST" }),
  payoutSettings: (actor: string) => call<PayoutSettings>(actor, "/payout-settings"),
  updatePayoutSettings: (actor: string, body: { minPayoutMinor: number; version: number }) =>
    call<PayoutSettings>(actor, "/payout-settings", { method: "PUT", body }),
  /** After the gateway ruled a dispute lost: creator debited, platform fee returned, downloads blocked or session cancelled. */
  confirmDisputeLoss: (actor: string, id: string) =>
    call<{ debitedMinor: number; feeReturnedMinor: number; accessBlocked: boolean; item: PaymentExceptionRow }>(
      actor, `/exceptions/${encodeURIComponent(id)}/confirm-loss`, { method: "POST" }),
  orders: (actor: string, page: number) => call<StorePage<StoreOrder>>(actor, `/orders?page=${page}`),
  products: (actor: string, page: number) => call<StorePage<StoreProduct>>(actor, `/products?page=${page}`),
  suspend: (actor: string, id: string, reason: string) =>
    call<null>(actor, `/products/${encodeURIComponent(id)}/suspend`, { method: "POST", body: { reason } }),
  unsuspend: (actor: string, id: string) =>
    call<null>(actor, `/products/${encodeURIComponent(id)}/unsuspend`, { method: "POST" }),
};

/** A review in the moderation queue. Creators report reviews; only an admin hides one. */
export interface ReviewRow {
  id: string;
  creatorId: string;
  creatorName: string | null;
  creatorUsername: string | null;
  reviewerName: string;
  rating: number;
  body: string;
  itemTitle: string;
  kind: "PRODUCT" | "SESSION";
  status: "REQUESTED" | "PUBLISHED" | "HIDDEN";
  moderation: "NONE" | "REPORTED" | "KEPT" | "HIDDEN";
  reportReason: string | null;
  reportNote: string | null;
  reportedAt: string | null;
  moderationNote: string | null;
  replyBody: string | null;
  /** The sale behind the review was reversed, so it can never be shown again. */
  saleReversed: boolean;
}

export const reviewApi = {
  queue: (actor: string, state: string, page: number) =>
    call<{ rows: ReviewRow[]; page: number; size: number; total: number; totalPages: number }>(
      actor, `?state=${encodeURIComponent(state)}&page=${page}`, undefined, "/api/admin/reviews"),
  hide: (actor: string, id: string, reason: string) =>
    call<null>(actor, `/${encodeURIComponent(id)}/hide`, { method: "POST", body: { reason } }, "/api/admin/reviews"),
  keep: (actor: string, id: string, note: string) =>
    call<null>(actor, `/${encodeURIComponent(id)}/keep`, { method: "POST", body: { note: note || undefined } }, "/api/admin/reviews"),
};

export type AdminRole = "SUPPORT" | "FINANCE" | "SUPER_ADMIN";

export interface BackendAdmin {
  email: string;
  role: AdminRole;
  active: boolean;
  createdBy: string | null;
  createdAt: string | null;
  lastSeenAt: string | null;
}

/** Who may use the admin API, and with which role. Super admin only; the backend enforces every rule. */
export const adminUsersApi = {
  list: (actor: string) => call<BackendAdmin[]>(actor, "", undefined, "/api/admin/users"),
  /** The caller's own role as the backend sees it. */
  me: (actor: string) => call<{ email: string; role: AdminRole; method: string }>(actor, "/me", undefined, "/api/admin/users"),
  /** Adds an admin, or changes the role of an existing one. */
  grant: (actor: string, email: string, role: AdminRole) =>
    call<BackendAdmin>(actor, "", { method: "POST", body: { email, role } }, "/api/admin/users"),
  deactivate: (actor: string, email: string) =>
    call<BackendAdmin>(actor, `/${encodeURIComponent(email)}/deactivate`, { method: "POST" }, "/api/admin/users"),
  activate: (actor: string, email: string) =>
    call<BackendAdmin>(actor, `/${encodeURIComponent(email)}/activate`, { method: "POST" }, "/api/admin/users"),
};
