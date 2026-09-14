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
  Ticket,
  Tags,
  Eye,
} from "lucide-react";
import { logoutAction } from "@/actions/user.actions";
import { cn } from "@/lib/utils";
import { DatabaseSwitch } from "@/components/shared/DatabaseSwitch";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: number;
};

interface AdminSidebarProps {
  adminName: string | null | undefined;
  adminEmail: string | null | undefined;
  adminImage: string | null | undefined;
  hasStagingDb?: boolean;
  isReadOnly?: boolean;
  pendingBeta?: number;
}

function isNavActive(pathname: string, href: string) {
  const path = href.split("?")[0];
  if (path === "/admin/dashboard") {
    return pathname === "/admin/dashboard" || pathname === "/admin";
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13.5px] font-medium outline-none ring-0 transition-colors [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:outline-none",
        active
          ? "bg-white/[0.09] text-white"
          : "text-white/80 hover:bg-white/[0.06] hover:text-white"
      )}
    >
      <Icon
        className={cn("h-[18px] w-[18px] shrink-0", active ? "text-[#FF6719]" : "text-white/70")}
        strokeWidth={active ? 2.25 : 1.9}
      />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {typeof item.badge === "number" && item.badge > 0 ? (
        <span className="rounded-md bg-[#FF6719] px-1.5 py-px text-[10px] font-bold tabular-nums text-white">
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <div>
      <p className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#FF6719]">
        {label}
      </p>
      <ul className="space-y-1.5">
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
  isReadOnly = false,
  pendingBeta = 0,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const workNav: NavItem[] = [
    { label: "Command", href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Queue", href: "/admin/beta?status=PENDING", icon: ClipboardList, badge: pendingBeta },
    { label: "Users", href: "/admin/users", icon: Users },
  ];
  const moneyNav: NavItem[] = [
    { label: "Plans", href: "/admin/plans", icon: Tags },
    { label: "Coupons", href: "/admin/coupons", icon: Ticket },
    { label: "Payments", href: "/admin/payments", icon: Receipt },
  ];
  const systemNav: NavItem[] = [
    { label: "Audit", href: "/admin/audit", icon: Shield },
    { label: "Logs", href: "/admin/logs", icon: Terminal },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ];

  return (
    <aside className="flex h-full w-[var(--sidebar-width)] shrink-0 select-none flex-col border-r border-white/[0.08] bg-[#0A0908]">
      <div className="flex h-14 shrink-0 items-center gap-2.5 px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FF6719]">
          <span className="text-[14px] font-black leading-none text-white">P</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold tracking-tight text-white">Plugio</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/45">
            Operations
          </p>
        </div>
      </div>

      {isReadOnly && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-lg border border-sky-500/25 bg-sky-500/10 px-2.5 py-1.5">
            <Eye className="h-3.5 w-3.5 shrink-0 text-sky-300" />
            <p className="text-[11px] font-medium text-sky-100">Read-only</p>
          </div>
        </div>
      )}

      <nav className="flex min-h-0 flex-1 flex-col justify-between overflow-y-auto px-2.5 py-5">
        <NavGroup label="Work" items={workNav} pathname={pathname} />
        <NavGroup label="Billing" items={moneyNav} pathname={pathname} />
        <NavGroup label="System" items={systemNav} pathname={pathname} />
      </nav>

      <div className="shrink-0 space-y-2.5 border-t border-white/[0.08] p-3">
        <DatabaseSwitch compact tone="dark" />

        <div className="flex items-center gap-2">
          {adminImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={adminImage}
              alt={adminName ?? "Admin"}
              className="h-8 w-8 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FF6719] text-[11px] font-bold text-white">
              {adminName?.[0]?.toUpperCase() ?? "A"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold text-white">{adminName ?? "Admin"}</p>
            <p className="truncate text-[11px] text-white/50">{adminEmail ?? ""}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/55 outline-none ring-0 transition hover:bg-white/[0.08] hover:text-white focus:outline-none"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
