export type AdminRole = "SUPPORT" | "FINANCE" | "SUPER_ADMIN";

/**
 * What an admin may do in this app. Mirrors the backend's AdminRole table for the actions the backend guards, and
 * covers the actions this app writes straight to MySQL (beta access, coupons, plan prices), which the backend never sees.
 */
export type Capability =
  | "VIEW"
  | "REVIEW_BETA"
  | "MANAGE_COUPONS"
  | "EDIT_PLANS"
  | "VIEW_MONEY"
  | "VIEW_LOGS"
  | "MANAGE_ADMINS";

const ROLE_CAPABILITIES: Record<AdminRole, ReadonlySet<Capability>> = {
  SUPPORT: new Set<Capability>(["VIEW", "REVIEW_BETA"]),
  FINANCE: new Set<Capability>(["VIEW", "VIEW_MONEY"]),
  SUPER_ADMIN: new Set<Capability>([
    "VIEW",
    "REVIEW_BETA",
    "MANAGE_COUPONS",
    "EDIT_PLANS",
    "VIEW_MONEY",
    "VIEW_LOGS",
    "MANAGE_ADMINS",
  ]),
};

export interface AdminAccess {
  role: AdminRole;
  can: (capability: Capability) => boolean;
}

export function accessForRole(role: AdminRole): AdminAccess {
  const caps = ROLE_CAPABILITIES[role];
  return { role, can: (capability) => caps.has(capability) };
}

