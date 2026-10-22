import "server-only";

import { getActiveDbContext } from "@/lib/db";
import { signAdminToken } from "@/lib/admin-token";

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

export interface StoreOrder {
  id: string;
  productTitle: string;
  sellerId: string;
  sellerName: string | null;
  buyerEmail: string;
  amountMinor: number;
  platformFeeMinor: number;
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
  version: number;
  updatedBy: string | null;
  updatedAt: string | null;
}

export class StoreApiError extends Error {}

async function resolveBackendConfig(): Promise<{ backend: string; apiKey: string }> {
  const isStaging = (await getActiveDbContext()) === "staging";
  const isDev = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_ENVIRONMENT === "development";

  let backend: string | undefined;
  let apiKey: string | undefined;

  if (isStaging) {
    // When staging is active:
    // If explicitly configured, use STAGING_BACKEND_API_URL.
    // In local dev, use BACKEND_API_URL or localhost.
    // In deployed admin panel, automatically default to https://staging-api.plugio.app.
    backend =
      process.env.STAGING_BACKEND_API_URL ||
      (isDev ? process.env.BACKEND_API_URL || "http://localhost:8080" : "https://staging-api.plugio.app");

    apiKey = process.env.STAGING_ADMIN_API_KEY || process.env.ADMIN_API_KEY;

    if (!apiKey) {
      throw new StoreApiError(
        "ADMIN_API_KEY is not configured. Please set ADMIN_API_KEY or STAGING_ADMIN_API_KEY in .env.local."
      );
    }
  } else {
    backend = process.env.BACKEND_API_URL || (isDev ? "http://localhost:8080" : undefined);
    apiKey = process.env.ADMIN_API_KEY;

    if (!backend) {
      throw new StoreApiError("BACKEND_API_URL is not configured.");
    }
    if (!apiKey) {
      throw new StoreApiError("ADMIN_API_KEY is not configured.");
    }
  }

  return { backend: backend.replace(/\/+$/, ""), apiKey };
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
  const token = signAdminToken({ email: actor, method, path: urlPath.split("?")[0] });

  let res: Response;
  try {
    res = await fetch(`${backend}${urlPath}`, {
      method,
      headers: {
        "X-Admin-Api-Key": apiKey,
        "X-Admin-Actor": actor,
        ...(token ? { "X-Admin-Token": token } : {}),
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
      throw new StoreApiError("Access denied. You do not have permission to access Store operations.");
    }
    throw new StoreApiError(json?.message || `Backend request failed (${res.status})`);
  }
  return json?.data as T;
}

export const storeApi = {
  commissionPolicy: (actor: string) => call<CommissionPolicy>(actor, "/monetization"),
  updateCommissionPolicy: (actor: string, body: { digitalProductsFeePercent: number; bookingsFeePercent: number; version: number }) =>
    call<CommissionPolicy>(actor, "/monetization", { method: "PUT", body }),
  payouts: (actor: string, status: string, page: number) =>
    call<StorePage<StorePayout>>(actor, `/payouts?status=${encodeURIComponent(status)}&page=${page}`),
  markPaid: (actor: string, id: string, reference: string) =>
    call<StorePayout>(actor, `/payouts/${encodeURIComponent(id)}/paid`, { method: "POST", body: { reference } }),
  rejectPayout: (actor: string, id: string, reason: string) =>
    call<StorePayout>(actor, `/payouts/${encodeURIComponent(id)}/reject`, { method: "POST", body: { reason } }),
  exceptions: (actor: string, activeOnly: boolean, page: number) =>
    call<StorePage<PaymentExceptionRow>>(actor, `/exceptions?activeOnly=${activeOnly}&page=${page}`),
  dismissException: (actor: string, id: string, reason: string) =>
    call<PaymentExceptionRow>(actor, `/exceptions/${encodeURIComponent(id)}/dismiss`, { method: "POST", body: { reason } }),
  sellerStatement: (actor: string, sellerId: string, page: number) =>
    call<SellerStatement>(actor, `/sellers/${encodeURIComponent(sellerId)}/statement?page=${page}&size=50`),
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
