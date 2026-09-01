"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Settings,
  LogOut,
  Shield,
  Receipt,
  Terminal,
  Ticket,
  Eye,
  Database,
} from "lucide-react";
import { logoutAction } from "@/actions/user.actions";
import { cn } from "@/lib/utils";
import { ENVIRONMENT } from "@/constants";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: string;
};

const primaryNav: NavItem[] = [
  { label: "Overview", href: "/admin/dashboard", icon: LayoutDashboard },
];

const accessNav: NavItem[] = [
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Beta Requests", href: "/admin/beta", icon: ClipboardList },
];

const billingNav: NavItem[] = [
  { label: "Coupons", href: "/admin/coupons", icon: Ticket },
  { label: "Payments", href: "/admin/payments", icon: Receipt },
];

const systemNav: NavItem[] = [
  { label: "Audit Log", href: "/admin/audit", icon: Shield },
  { label: "Server Logs", href: "/admin/logs", icon: Terminal },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

interface AdminSidebarProps {
  adminName: string | null | undefined;
  adminEmail: string | null | undefined;
  adminImage: string | null | undefined;
  hasStagingDb?: boolean;
  isReadOnly?: boolean;
}

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift();
  return undefined;
}

function isNavActive(pathname: string, href: string) {
  if (href === "/admin/dashboard") {
    return pathname === "/admin/dashboard" || pathname === "/admin";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
        active
          ? "bg-white/[0.07] text-white"
          : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-100"
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full transition-opacity",
          active ? "bg-[#FF6719] opacity-100" : "opacity-0"
        )}
      />
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          active ? "text-[#FF6719]" : "text-neutral-500 group-hover:text-neutral-300"
        )}
        strokeWidth={active ? 2.25 : 1.75}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function NavSection({
  title,
  items,
  pathname,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <div className="space-y-1">
      <p className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
        {title}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.href}>
            <NavLink item={item} pathname={pathname} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminSidebar({
  adminName,
  adminEmail,
  adminImage,
  hasStagingDb = true,
  isReadOnly = false,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [dbContext, setDbContext] = useState<"production" | "staging">(
    "production"
  );

  useEffect(() => {
    const current =
      getCookie("plugio_db_context") ||
      (ENVIRONMENT === "staging" ? "staging" : "production");
    if (current === "production" || current === "staging") {
      setDbContext(current as "production" | "staging");
    }
  }, []);

  const handleDbContextChange = (newContext: "production" | "staging") => {
    if (newContext === dbContext) return;

    if (newContext === "production") {
      const confirmed = window.confirm(
        "Switch to PRODUCTION database?\n\nCoupon, grant, and beta mutations will affect live users. Continue only if intentional."
      );
      if (!confirmed) return;
    }

    document.cookie = `plugio_db_context=${newContext}; path=/; max-age=31536000; sameSite=lax`;
    setDbContext(newContext);
    window.location.reload();
  };

  return (
    <aside className="flex h-full w-[240px] shrink-0 select-none flex-col border-r border-white/[0.06] bg-[#111110]">
      {/* Brand */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#FF6719]">
          <span className="text-sm font-black leading-none text-white">P</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold tracking-tight text-white">
              Plugio
            </p>
            {ENVIRONMENT !== "production" && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400">
                {ENVIRONMENT === "development" ? "Dev" : "Staging"}
              </span>
            )}
          </div>
          <p className="text-[11px] font-medium text-neutral-500">Admin</p>
        </div>
      </div>

      {/* Status chips */}
      {(isReadOnly || dbContext === "production") && (
        <div className="space-y-1.5 border-b border-white/[0.06] px-3 py-3">
          {isReadOnly && (
            <div className="flex items-center gap-2 rounded-md border border-sky-500/20 bg-sky-500/10 px-2.5 py-1.5">
              <Eye className="h-3.5 w-3.5 shrink-0 text-sky-400" />
              <p className="text-[11px] font-medium leading-snug text-sky-200">
                Read-only — writes blocked
              </p>
            </div>
          )}
          {dbContext === "production" && (
            <div className="rounded-md border border-red-500/25 bg-red-500/10 px-2.5 py-1.5">
              <p className="text-[11px] font-semibold text-red-300">
                Production database
              </p>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
        <div className="space-y-0.5">
          {primaryNav.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>

        <NavSection title="Access" items={accessNav} pathname={pathname} />
        <NavSection title="Billing" items={billingNav} pathname={pathname} />
        <NavSection title="System" items={systemNav} pathname={pathname} />
      </nav>

      {/* Database + account */}
      <div className="shrink-0 space-y-3 border-t border-white/[0.06] p-3">
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 px-1">
            <Database className="h-3 w-3 text-neutral-600" />
            <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-600">
              Database
            </label>
          </div>
          <div className="relative">
            <select
              value={dbContext}
              onChange={(e) =>
                handleDbContextChange(e.target.value as "production" | "staging")
              }
              className="w-full appearance-none rounded-md border border-white/10 bg-[#0c0c0b] px-2.5 py-2 pr-8 text-xs font-medium text-neutral-300 transition-colors hover:border-white/20 focus:border-[#FF6719] focus:outline-none"
            >
              <option value="production">Production</option>
              <option value="staging">
                {hasStagingDb ? "Staging" : "Staging (fallback)"}
              </option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-neutral-500">
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
          {!hasStagingDb && dbContext === "staging" && (
            <p className="mt-1.5 px-1 text-[10px] leading-relaxed text-amber-500/80">
              Staging DB not configured — using active connection.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5 rounded-md border border-white/[0.06] bg-white/[0.03] px-2.5 py-2">
          {adminImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={adminImage}
              alt={adminName ?? "Admin"}
              className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/10"
            />
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
              <span className="text-[11px] font-bold text-neutral-300">
                {adminName?.[0]?.toUpperCase() ?? "A"}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">
              {adminName ?? "Admin"}
            </p>
            <p className="truncate text-[10px] text-neutral-500">
              {adminEmail ?? ""}
            </p>
          </div>
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium text-neutral-500 transition-colors hover:bg-white/[0.04] hover:text-red-400"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
