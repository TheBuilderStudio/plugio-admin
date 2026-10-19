import "server-only";

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
  refundReason: string | null;
  paidAt: string | null;
  refundedAt: string | null;
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

export class StoreApiError extends Error {}

async function call<T>(actor: string, path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const apiKey = process.env.ADMIN_API_KEY;
  if (!apiKey) throw new StoreApiError("ADMIN_API_KEY is not configured");
  const backend = process.env.BACKEND_API_URL || "http://localhost:8080";

  const res = await fetch(`${backend}/api/admin/store${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "X-Admin-Api-Key": apiKey,
      "X-Admin-Actor": actor,
      Accept: "application/json",
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  const json = (await res.json().catch(() => null)) as { data?: T; message?: string } | null;
  if (!res.ok) {
    throw new StoreApiError(json?.message || `Backend request failed (${res.status})`);
  }
  return json?.data as T;
}

export const storeApi = {
  payouts: (actor: string, status: string, page: number) =>
    call<StorePage<StorePayout>>(actor, `/payouts?status=${encodeURIComponent(status)}&page=${page}`),
  markPaid: (actor: string, id: string, reference: string) =>
    call<StorePayout>(actor, `/payouts/${encodeURIComponent(id)}/paid`, { method: "POST", body: { reference } }),
  rejectPayout: (actor: string, id: string, reason: string) =>
    call<StorePayout>(actor, `/payouts/${encodeURIComponent(id)}/reject`, { method: "POST", body: { reason } }),
  orders: (actor: string, page: number) => call<StorePage<StoreOrder>>(actor, `/orders?page=${page}`),
  refund: (actor: string, id: string, reason: string) =>
    call<string>(actor, `/orders/${encodeURIComponent(id)}/refund`, { method: "POST", body: { reason } }),
  products: (actor: string, page: number) => call<StorePage<StoreProduct>>(actor, `/products?page=${page}`),
  suspend: (actor: string, id: string, reason: string) =>
    call<null>(actor, `/products/${encodeURIComponent(id)}/suspend`, { method: "POST", body: { reason } }),
  unsuspend: (actor: string, id: string) =>
    call<null>(actor, `/products/${encodeURIComponent(id)}/unsuspend`, { method: "POST" }),
};
