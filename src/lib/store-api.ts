import "server-only";

import { getActiveDbContext } from "@/lib/db";

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

async function call<T>(actor: string, path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const { backend, apiKey } = await resolveBackendConfig();

  let res: Response;
  try {
    res = await fetch(`${backend}/api/admin/store${path}`, {
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
  orders: (actor: string, page: number) => call<StorePage<StoreOrder>>(actor, `/orders?page=${page}`),
  products: (actor: string, page: number) => call<StorePage<StoreProduct>>(actor, `/products?page=${page}`),
  suspend: (actor: string, id: string, reason: string) =>
    call<null>(actor, `/products/${encodeURIComponent(id)}/suspend`, { method: "POST", body: { reason } }),
  unsuspend: (actor: string, id: string) =>
    call<null>(actor, `/products/${encodeURIComponent(id)}/unsuspend`, { method: "POST" }),
};
