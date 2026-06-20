"use client";

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
}

export function AdminSidebar({
  adminName,
  adminEmail,
  adminImage,
}: AdminSidebarProps) {
  const pathname = usePathname();

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


