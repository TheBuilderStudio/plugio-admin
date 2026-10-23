import "server-only";

import { adminAuthHeaders } from "@/lib/admin-token";
import { resolveBackendUrl } from "@/lib/backend-url";

/**
 * Admins added on the Admins page live in the backend's admin_users table, not in ADMIN_EMAILS. This asks the backend
 * whether an email is one of them.
 *
 * Only a SIGNED answer counts. In legacy mode the backend accepts any claimed name as a super admin, so trusting it
 * would let anyone who can sign in with Google through; without a signing key this always answers false and the
 * ADMIN_EMAILS list stays the only gate. Any error also answers false: the check fails closed.
 */
export async function isActiveBackendAdmin(email: string): Promise<boolean> {
  if (!process.env.ADMIN_SIGNING_PRIVATE_KEY) return false;
  const backend = resolveBackendUrl(false);
  if (!backend) return false;
  const path = "/api/admin/users/me";
  try {
    const res = await fetch(`${backend}${path}`, {
      headers: { ...adminAuthHeaders({ actor: email, method: "GET", path }), Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { data?: { email?: string; method?: string } } | null;
    return body?.data?.method === "SIGNED_TOKEN" && body.data.email?.toLowerCase() === email.trim().toLowerCase();
  } catch {
    return false;
  }
}
