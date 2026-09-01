"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ClipboardList, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/admin/dashboard": {
    title: "Overview",
    subtitle: "Revenue, plans, and platform pulse",
  },
  "/admin/users": {
    title: "Users",
    subtitle: "Directory and entitlements",
  },
  "/admin/beta": {
    title: "Beta Requests",
    subtitle: "Access review queue",
  },
  "/admin/coupons": {
    title: "Coupons",
    subtitle: "Trial codes and redemptions",
  },
  "/admin/payments": {
    title: "Payments",
    subtitle: "Checkout and invoice trail",
  },
  "/admin/audit": {
    title: "Audit Log",
    subtitle: "Operator actions",
  },
  "/admin/logs": {
    title: "Server Logs",
    subtitle: "Runtime stream",
  },
  "/admin/settings": {
    title: "Settings",
    subtitle: "Configuration",
  },
};

function resolveMeta(pathname: string) {
  if (pathname.startsWith("/admin/users/")) {
    return { title: "User", subtitle: "Profile, billing, and grants" };
  }
  return (
    TITLES[pathname] ?? {
      title: "Admin",
      subtitle: "Plugio",
    }
  );
}

interface AdminTopBarProps {
  isReadOnly?: boolean;
  pendingBeta?: number;
}

/**
 * Product chrome — mirrors plugio-frontend DashboardHeader:
 * frosted bar, page context, brand-accent actions. No infra noise.
 */
export function AdminTopBar({
  isReadOnly = false,
  pendingBeta = 0,
}: AdminTopBarProps) {
  const pathname = usePathname();
  const meta = resolveMeta(pathname);
  const onOverview =
    pathname === "/admin/dashboard" || pathname === "/admin";

  return (
    <header
      className={cn(
        "z-30 flex h-14 shrink-0 items-center justify-between gap-4",
        "px-4 sm:px-5 lg:px-6",
        "bg-white/80 backdrop-blur-xl",
        "border-b border-neutral-200/60",
        "shadow-[0_4px_24px_-12px_rgba(249,115,22,0.08)]"
      )}
    >
      <div className="min-w-0">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400"
        >
          <span className="hidden sm:inline">Plugio</span>
          <ChevronRight className="hidden h-3 w-3 sm:inline" aria-hidden />
          <span className="truncate text-neutral-600" aria-current="page">
            {meta.title}
          </span>
        </nav>
        <p className="truncate text-[13px] font-semibold tracking-tight text-neutral-900 sm:text-sm">
          {meta.subtitle}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {pendingBeta > 0 && (
          <Link
            href="/admin/beta?status=PENDING"
            aria-label={`${pendingBeta} pending beta requests`}
            className="inline-flex items-center gap-1.5 rounded-[14px] border border-orange-200/80 bg-[#fff7ed] px-2.5 py-1.5 text-[11px] font-bold text-[#FF6719] transition-colors hover:border-[#FF6719]/40 hover:bg-orange-50"
          >
            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">{pendingBeta} pending</span>
            <span className="sm:hidden">{pendingBeta}</span>
          </Link>
        )}

        {isReadOnly && (
          <span
            className="rounded-[10px] border border-sky-200/80 bg-sky-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-700"
            title="Mutations are disabled in read-only mode"
          >
            Read-only
          </span>
        )}

        {/* Contextual primary action — never a no-op self-link on Overview */}
        {onOverview ? (
          <Link
            href="/admin/users"
            className="hidden items-center gap-1.5 rounded-[14px] bg-gradient-to-b from-[#ff7a33] to-[#FF6719] px-3 py-1.5 text-[12px] font-bold text-white shadow-sm shadow-orange-500/25 transition-opacity hover:opacity-95 sm:inline-flex"
          >
            <Users className="h-3.5 w-3.5" aria-hidden />
            Users
          </Link>
        ) : (
          <Link
            href="/admin/dashboard"
            className="hidden rounded-[14px] bg-gradient-to-b from-[#ff7a33] to-[#FF6719] px-3 py-1.5 text-[12px] font-bold text-white shadow-sm shadow-orange-500/25 transition-opacity hover:opacity-95 sm:inline-flex"
          >
            Overview
          </Link>
        )}
      </div>
    </header>
  );
}
