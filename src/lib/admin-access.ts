import "server-only";

import { cache } from "react";
import type { Session } from "next-auth";
import { ADMIN_EMAILS } from "@/constants";
import { adminUsersApi } from "@/lib/store-api";
import { accessForRole, type AdminAccess, type Capability } from "@/lib/admin-roles";
import { normalizeAdminEmail } from "@/lib/security/emails";

export { accessForRole, type AdminAccess, type Capability } from "@/lib/admin-roles";

/**
 * Owners in ADMIN_EMAILS are super admins. Anyone else gets the role the backend holds for them; if the backend cannot
 * answer, they get the lowest role (support) rather than a guess upwards.
 */
export const getAdminAccess = cache(async (session: Session): Promise<AdminAccess> => {
  const email = normalizeAdminEmail(session.user?.email);
  if (!email) return accessForRole("SUPPORT");
  if (ADMIN_EMAILS.includes(email)) return accessForRole("SUPER_ADMIN");
  try {
    const me = await adminUsersApi.me(email);
    return accessForRole(me.role);
  } catch {
    return accessForRole("SUPPORT");
  }
});

export class CapabilityError extends Error {}

export async function assertCapability(session: Session, capability: Capability): Promise<void> {
  const access = await getAdminAccess(session);
  if (!access.can(capability)) {
    throw new CapabilityError(`FORBIDDEN: your role (${access.role.replace("_", " ").toLowerCase()}) cannot do this`);
  }
}
