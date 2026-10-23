import type { Capability } from "@/lib/admin-roles";

export type NavIconName =
  | "dashboard"
  | "beta"
  | "users"
  | "bookings"
  | "inquiries"
  | "reviews"
  | "plans"
  | "coupons"
  | "payments"
  | "transactions"
  | "reports"
  | "store"
  | "health"
  | "admins"
  | "audit"
  | "logs"
  | "settings";

/** The sectors of the console, in the order the sidebar shows them. "Overview" is one page and has no heading. */
export const NAV_GROUPS = ["Overview", "People", "Marketplace", "Money", "Pricing", "Platform", "Admin", "Audit & logs"] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

export type NavEntry = {
  label: string;
  href: string;
  icon: NavIconName;
  group: NavGroup;
  /** Hidden from admins whose role lacks this. Server pages still enforce their own checks. */
  needs?: Capability;
  keywords?: string;
  /** Second key of the "g then key" jump shortcut. */
  key?: string;
};

export const NAV: NavEntry[] = [
  { label: "Overview", key: "o", href: "/admin/dashboard", icon: "dashboard", group: "Overview", keywords: "home dashboard command" },

  { label: "Access requests", key: "a", href: "/admin/beta?status=PENDING", icon: "beta", group: "People", keywords: "queue beta waitlist apply" },
  { label: "Creators", key: "c", href: "/admin/users", icon: "users", group: "People", keywords: "users people accounts" },
  { label: "Brand inquiries", key: "i", href: "/admin/inquiries", icon: "inquiries", group: "People", keywords: "portfolio messages brands" },

  { label: "Sessions", key: "s", href: "/admin/bookings", icon: "bookings", group: "Marketplace", keywords: "bookings calendar refunds cancelled" },
  { label: "Digital store", key: "m", href: "/admin/store", icon: "store", group: "Marketplace", needs: "VIEW_MONEY", keywords: "store money payouts kyc settlements refunds disputes products" },
  { label: "Reviews", key: "r", href: "/admin/reviews", icon: "reviews", group: "Marketplace", keywords: "moderation reports" },

  { label: "Transactions", key: "t", href: "/admin/transactions", icon: "transactions", group: "Money", needs: "VIEW_MONEY", keywords: "orders sessions gmv" },
  { label: "Subscription payments", href: "/admin/payments", icon: "payments", group: "Money", needs: "VIEW_MONEY", keywords: "billing razorpay events" },
  { label: "Reports", key: "e", href: "/admin/reports", icon: "reports", group: "Money", needs: "VIEW_MONEY", keywords: "revenue commission csv" },

  { label: "Plans", key: "p", href: "/admin/plans", icon: "plans", group: "Pricing", needs: "VIEW_MONEY", keywords: "pricing catalog" },
  { label: "Coupons", key: "u", href: "/admin/coupons", icon: "coupons", group: "Pricing", needs: "VIEW_MONEY", keywords: "discount trial code" },

  { label: "Platform health", key: "h", href: "/admin/health", icon: "health", group: "Platform", keywords: "failures publish sync status" },

  { label: "Admins", key: "d", href: "/admin/admins", icon: "admins", group: "Admin", needs: "MANAGE_ADMINS", keywords: "roles team" },
  { label: "Settings", key: "x", href: "/admin/settings", icon: "settings", group: "Admin" },

  { label: "Audit trail", key: "l", href: "/admin/audit", icon: "audit", group: "Audit & logs", keywords: "history who did what" },
  { label: "Logs", href: "/admin/logs", icon: "logs", group: "Audit & logs", needs: "VIEW_LOGS", keywords: "errors stream" },
];

function matchFor(pathname: string): NavEntry | undefined {
  return NAV.filter((n) => {
    const p = n.href.split("?")[0];
    return pathname === p || pathname.startsWith(`${p}/`);
  }).sort((a, b) => b.href.length - a.href.length)[0];
}

/** Page name for the top bar: the sidebar label, so the two can never disagree. */
export function titleFor(pathname: string): string | null {
  return matchFor(pathname)?.label ?? null;
}

export type Crumb = { label: string; href?: string };

/**
 * Breadcrumb for the top bar. Top-level pages return nothing: the sidebar already marks where you are and the
 * page heading names it, so repeating either in the top bar is noise. Only detail pages get a trail back to their parent.
 */
export function crumbsFor(pathname: string): Crumb[] {
  if (pathname.startsWith("/admin/users/")) return [{ label: "Creators", href: "/admin/users" }, { label: "Creator" }];
  if (pathname.startsWith("/admin/store/seller/"))
    return [{ label: "Digital store", href: "/admin/store?tab=payouts" }, { label: "Seller statement" }];
  return [];
}
