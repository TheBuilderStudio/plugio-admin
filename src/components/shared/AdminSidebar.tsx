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
} from "lucide-react";
import { logoutAction } from "@/actions/user.actions";
import { cn } from "@/lib/utils";
import { ENVIRONMENT } from "@/constants";

const navItems = [
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Users",
    href: "/admin/users",
    icon: Users,
  },
  {
    label: "Beta Requests",
    href: "/admin/beta",
    icon: ClipboardList,
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
  {
    label: "Payments",
    href: "/admin/payments",
    icon: Receipt,
  },
  {
    label: "Server Logs",
    href: "/admin/logs",
    icon: Terminal,
  },
  {
    label: "Audit Log",
    href: "/admin/audit",
    icon: Shield,
  },
];

interface AdminSidebarProps {
  adminName: string | null | undefined;
  adminEmail: string | null | undefined;
  adminImage: string | null | undefined;
  hasStagingDb?: boolean;
}

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift();
  return undefined;
}

export function AdminSidebar({
  adminName,
  adminEmail,
  adminImage,
  hasStagingDb = true,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [dbContext, setDbContext] = useState<"production" | "staging">("production");

  useEffect(() => {
    const current = getCookie("plugio_db_context") || (ENVIRONMENT === "staging" ? "staging" : "production");
    if (current === "production" || current === "staging") {
      setDbContext(current as "production" | "staging");
    }
  }, []);

  const handleDbContextChange = (newContext: "production" | "staging") => {
    document.cookie = `plugio_db_context=${newContext}; path=/; max-age=31536000; sameSite=lax`;
    setDbContext(newContext);
    window.location.reload();
  };

  return (
    <aside
      className="flex flex-col h-full w-64 flex-shrink-0 select-none bg-[#0D0C0B] border-r border-white/5"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-white/5 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-[#FF6719] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-black text-sm leading-none">P</span>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-white font-bold text-base leading-none">Plugio</p>
            {ENVIRONMENT !== "production" && (
              <span className="bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-amber-500/20 tracking-wider">
                {ENVIRONMENT === "development" ? "Dev" : "Staging"}
              </span>
            )}
          </div>
          <p className="text-[#FF6719] text-[10px] font-bold tracking-widest uppercase mt-0.5">
            Admin
          </p>
        </div>
      </div>

      {/* Database Context Switcher */}
      <div className="px-6 py-4 border-b border-white/5 bg-[#141312]/60">
        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">
          Database Connection
        </label>
        <div className="relative">
          <select
            value={dbContext}
            onChange={(e) => handleDbContextChange(e.target.value as "production" | "staging")}
            className="w-full bg-[#0D0C0B] border border-white/10 hover:border-white/20 rounded-lg px-3 py-2 text-xs font-semibold text-neutral-300 focus:outline-none focus:border-[#FF6719] cursor-pointer appearance-none transition-colors"
          >
            <option value="production">Production DB</option>
            <option value="staging">
              {hasStagingDb ? "Staging DB" : "Staging DB (Fallback)"}
            </option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
            </svg>
          </div>
        </div>
        {!hasStagingDb && dbContext === "staging" && (
          <p className="text-[10px] text-amber-500/80 mt-2 leading-relaxed">
            ⚠️ Staging database is not configured on this environment. Falling back to active DB.
          </p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest px-3 mb-3">
          Navigation
        </p>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin/dashboard" &&
                pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[#FF6719]/10 text-[#FF6719]"
                      : "text-neutral-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 flex-shrink-0",
                      isActive ? "text-[#FF6719]" : "text-neutral-500"
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Internal tools section */}
        <div className="mt-6 pt-5 border-t border-white/5">
          <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest px-3 mb-3">
            Access
          </p>
          <div className="px-3 py-2.5 rounded-lg bg-white/5 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#FF6719] flex-shrink-0" />
            <span className="text-neutral-300 text-xs font-semibold">
              Super Admin
            </span>
          </div>
        </div>
      </nav>

      {/* User section */}
      <div className="px-3 pb-5 flex-shrink-0 border-t border-white/5 pt-4">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 mb-2 border border-white/5">
          {adminImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={adminImage}
              alt={adminName ?? "Admin"}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-white/10"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <span className="text-neutral-300 text-xs font-bold">
                {adminName?.[0]?.toUpperCase() ?? "A"}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-semibold leading-tight truncate">
              {adminName ?? "Admin"}
            </p>
            <p className="text-neutral-500 text-xs leading-tight truncate mt-0.5">
              {adminEmail ?? ""}
            </p>
          </div>
        </div>

        {/* Logout */}
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-white/5 transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" strokeWidth={2} />
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  );
}


