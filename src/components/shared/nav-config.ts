import {
  Activity,
  CalendarClock,
  Inbox,
  BarChart3,
  ArrowLeftRight,
  ClipboardList,
  LayoutDashboard,
  Receipt,
  Settings,
  Shield,
  Star,
  Store,
  Tags,
  Terminal,
  Ticket,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Capability } from "@/lib/admin-roles";

export type NavEntry = {
  label: string;
  href: string;
  icon: LucideIcon;
  group: "Work" | "Money" | "System";
  /** Hidden from admins whose role lacks this. Server pages still enforce their own checks. */
  needs?: Capability;
  keywords?: string;
  /** Second key of the "g then key" jump shortcut. */
  key?: string;
};

export const NAV: NavEntry[] = [
  { label: "Overview", key: "o", href: "/admin/dashboard", icon: LayoutDashboard, group: "Work", keywords: "home dashboard command" },
  { label: "Access requests", key: "a", href: "/admin/beta?status=PENDING", icon: ClipboardList, group: "Work", keywords: "queue beta waitlist apply" },
  { label: "Creators", key: "c", href: "/admin/users", icon: Users, group: "Work", keywords: "users people accounts" },
  { label: "Sessions", key: "s", href: "/admin/bookings", icon: CalendarClock, group: "Work", keywords: "bookings calendar refunds cancelled" },
  { label: "Brand inquiries", key: "i", href: "/admin/inquiries", icon: Inbox, group: "Work", keywords: "portfolio messages brands" },
  { label: "Reviews", key: "r", href: "/admin/reviews", icon: Star, group: "Work", keywords: "moderation reports" },
  { label: "Plans", key: "p", href: "/admin/plans", icon: Tags, group: "Money", needs: "VIEW_MONEY", keywords: "pricing catalog" },
  { label: "Coupons", key: "u", href: "/admin/coupons", icon: Ticket, group: "Money", needs: "VIEW_MONEY", keywords: "discount trial code" },
  { label: "Subscription payments", href: "/admin/payments", icon: Receipt, group: "Money", needs: "VIEW_MONEY", keywords: "billing razorpay events" },
  { label: "Transactions", key: "t", href: "/admin/transactions", icon: ArrowLeftRight, group: "Money", needs: "VIEW_MONEY", keywords: "orders sessions gmv" },
  { label: "Reports", key: "e", href: "/admin/reports", icon: BarChart3, group: "Money", needs: "VIEW_MONEY", keywords: "revenue commission csv" },
  { label: "Store & payouts", key: "m", href: "/admin/store", icon: Store, group: "Money", needs: "VIEW_MONEY", keywords: "kyc settlements refunds disputes products" },
  { label: "Platform health", key: "h", href: "/admin/health", icon: Activity, group: "System", keywords: "failures publish sync status" },
  { label: "Admins", key: "d", href: "/admin/admins", icon: UserCog, group: "System", needs: "MANAGE_ADMINS", keywords: "roles team" },
  { label: "Audit trail", key: "l", href: "/admin/audit", icon: Shield, group: "System", keywords: "history who did what" },
  { label: "Logs", href: "/admin/logs", icon: Terminal, group: "System", needs: "VIEW_LOGS", keywords: "errors stream" },
  { label: "Settings", key: "x", href: "/admin/settings", icon: Settings, group: "System" },
];

/** Page title for the top bar; longest matching prefix wins. */
export function titleFor(pathname: string): string {
  if (pathname.startsWith("/admin/users/")) return "Creator";
  if (pathname.startsWith("/admin/store/seller/")) return "Seller statement";
  const match = NAV.filter((n) => {
    const p = n.href.split("?")[0];
    return pathname === p || pathname.startsWith(`${p}/`);
  }).sort((a, b) => b.href.length - a.href.length)[0];
  if (match) return match.label;
  if (pathname === "/admin") return "Overview";
  return "Console";
}
